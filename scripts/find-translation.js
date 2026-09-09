const nexusClient = require('../providers/nexus-client');

function clean(value = '') {
  return String(value).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
function norm(value = '') {
  return clean(value).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').replace(/\s+/g, ' ').trim();
}
function words(value = '') { return norm(value).split(' ').filter(Boolean); }
function ruMarker(name = '') { return /\brussian\b|\brus\b|\bru\b|рус(?:ский|ификатор|ская|ское|ские)?|перевод/i.test(name); }
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

async function findTranslation({ game, modName, author, modId } = {}) {
  if (!game) throw new Error('game is required for translation search');
  if (!modName) return null;
  const all = [];
  let successfulSearches = 0;
  let lastError = null;
  for (const query of variants(modName)) {
    try {
      all.push(...await nexusClient.searchMods({ game, name: query, limit: 40 }));
      successfulSearches += 1;
    } catch (error) {
      lastError = error;
      if (/401|403|API_KEY|APIKEY/i.test(error.message)) throw error;
    }
  }
  if (successfulSearches === 0 && lastError) throw lastError;

  const unique = [...new Map(all.filter(item => item?.modId).map(item => [String(item.modId), item])).values()]
    .filter(item => String(item.modId) !== String(modId || ''));
  const ranked = unique
    .filter(item => ruMarker(item.name || ''))
    .map(item => {
      const match = similarity(modName, item.name || '');
      const authorBonus = author && norm(item.author) === norm(author) ? 10 : 0;
      return { ...item, _score: match.score + authorBonus, _recall: match.recall, _precision: match.precision };
    })
    .sort((a, b) => b._score - a._score);
  const best = ranked[0];
  if (!best || best._recall < 0.6 || best._precision < 0.4 || best._score < 120) return null;
  return {
    game,
    originalModId: modId || null,
    translationId: String(best.modId),
    translationName: best.name,
    translationAuthor: best.author || null,
    score: Number(best._score.toFixed(1)),
    recall: Number(best._recall.toFixed(2)),
    precision: Number(best._precision.toFixed(2))
  };
}

module.exports = { findTranslation, similarity, ruMarker, variants };
