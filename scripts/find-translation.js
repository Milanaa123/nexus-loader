const nexusClient = require('../providers/nexus-client');

function clean(value = '') {
  return String(value).normalize('NFKC').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}
function norm(value = '') {
  return clean(value).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').replace(/\s+/g, ' ').trim();
}
function words(value = '') { return norm(value).split(' ').filter(Boolean); }
function ruMarker(name = '') { return /(?:^|[^\p{L}\p{N}])(?:russian|rus|ru|русский|русская|русское|русские|русификатор|русификация|перевод)(?=$|[^\p{L}\p{N}])/iu.test(name); }
function coreWords(value = '') {
  const stop = new Set(['russian', 'rus', 'ru', 'translation', 'translate', 'translated', 'перевод', 'русский', 'русская', 'русское', 'русские', 'русификатор', 'русификация', 'version', 'версия', 'for', 'для']);
  return words(value).filter(word => !stop.has(word));
}
function similarity(base, candidate) {
  const a = coreWords(base);
  const b = coreWords(candidate);
  if (!a.length || !b.length) return { score: 0, recall: 0, precision: 0 };
  const hit = a.filter(word => b.includes(word)).length;
  const recall = hit / a.length;
  const precision = b.filter(word => a.includes(word)).length / b.length;
  const exact = a.join(' ') === b.join(' ');
  let score = recall * 110 + precision * 90 + (exact ? 120 : 0);
  const aName = a.join(' ');
  const bName = b.join(' ');
  if (aName.length > 3 && bName.includes(aName)) score += 50;
  return { score, recall, precision };
}
function variants(modName) {
  const base = clean(modName);
  const short = coreWords(base).slice(0, 6).join(' ');
  return [...new Set([`${base} Russian`, `${base} Rus`, `${base} RU`, `${short} Russian`, base].filter(Boolean))].slice(0, 5);
}

function linksOriginal(description, game, modId) {
  const urls = String(description || '').match(/https?:\/\/[^\s"'<>[\]]+/gi) || [];
  return urls.some(value => {
    try {
      const url = new URL(value);
      const match = /^\/([a-z0-9_-]+)\/mods\/([1-9]\d*)\/?$/i.exec(url.pathname);
      return ['nexusmods.com', 'www.nexusmods.com'].includes(url.hostname.toLowerCase()) && !url.username && !url.password && match?.[1].toLowerCase() === game.toLowerCase() && match[2] === String(modId);
    } catch { return false; }
  });
}
function createTranslationFinder(options = {}) {
  const searchMods = options.searchMods || (query => nexusClient.searchMods(query));
  const getMod = options.getMod || (query => nexusClient.getMod(query));
  return async function findTranslation({ game, modName, author, modId, signal } = {}) {
    if (!game) throw new Error('game is required for translation search');
    if (!modName) return null;
    const all = []; const failures = [];
    let incomplete = false;
    const queries = variants(modName);
    for (const query of queries) {
      try {
        const candidates = await searchMods({ game, name: query, limit: 40, signal });
        if (!Array.isArray(candidates)) throw nexusClient.failure('NEXUS_RESPONSE_INVALID', 'Translation search returned invalid candidates');
        incomplete ||= candidates.search?.complete === false;
        all.push(...candidates);
      } catch (error) {
        if (error.code === 'NEXUS_RATE_LIMIT') throw error;
        if (error.code?.startsWith('NEXUS_') && error.retryable === false) throw error;
        failures.push(error);
      }
    }
    const unique = [...new Map(all.filter(item => item?.modId && (!item.game || item.game === game)).map(item => [String(item.modId), item])).values()]
      .filter(item => String(item.modId) !== String(modId || ''));
    const ranked = unique.filter(item => ruMarker(item.name || '')).map(item => {
      const match = similarity(modName, item.name || '');
      const authorBonus = author && norm(item.author) === norm(author) ? 10 : 0;
      return { ...item, _score: match.score + authorBonus, _recall: match.recall, _precision: match.precision };
    }).filter(item => item._recall >= 0.6 && item._precision >= 0.4 && item._score >= 120).sort((a, b) => b._score - a._score);
    const candidates = ranked.slice(0, 10).map(item => ({ modId: String(item.modId), name: item.name, author: item.author || '', game, score: Number(item._score.toFixed(1)), recall: Number(item._recall.toFixed(2)), precision: Number(item._precision.toFixed(2)) }));
    const search = { attempted: queries.length, succeeded: queries.length - failures.length, failed: failures.length, complete: !incomplete && failures.length === 0 };
    const review = reason => ({ status: 'needs_review', reason, game, originalModId: modId || null, candidates, search });
    if (failures.length) throw nexusClient.failure('NEXUS_SEARCH_INCOMPLETE', 'Translation search was interrupted; absence is not confirmed', true, {
      retryAfterMs: Math.max(0, ...failures.map(error => error.retryAfterMs || 0)), candidates, search
    });
    if (incomplete) return review('translation_search_incomplete');
    if (!ranked.length) return null;
    if (ranked.length > 1) return review('translation_ambiguous');
    const best = ranked[0];
    if (coreWords(modName).join(' ') !== coreWords(best.name).join(' ')) return review('translation_name_requires_confirmation');
    if (!/^[1-9]\d*$/.test(String(modId || ''))) return review('original_identity_required');
    const metadata = await getMod({ game, modId: String(best.modId), signal });
    const verified = require('../lib/mod-matcher').verifyModIdentity({ game, nexusModId: String(best.modId), name: best.name, author: best.author }, metadata);
    if (verified.status !== 'found') return review('translation_metadata_changed');
    if (!linksOriginal(metadata.description, game, modId)) return review('translation_link_unverified');
    return {
      status: 'translation_found', game, originalModId: String(modId), translationId: String(best.modId),
      translationName: verified.candidate.name, translationAuthor: verified.candidate.author || null,
      score: candidates[0].score, recall: candidates[0].recall, precision: candidates[0].precision,
      evidence: { exactCoreName: true, originalLink: true, source: 'nexus_description', compatibilityVerified: false }, search
    };
  };
}
const findTranslation = createTranslationFinder();
module.exports = { findTranslation, createTranslationFinder, similarity, ruMarker, variants, linksOriginal };
