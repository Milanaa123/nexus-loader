function normalize(value = '') {
  return String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function publicCandidate(candidate = {}) {
  return {
    modId: candidate.modId || candidate.mod_id || null,
    name: candidate.name || '',
    author: candidate.author || '',
    uploader: candidate.uploader || null,
    version: candidate.version || null,
    game: candidate.game || null,
    score: Number(candidate.score || 0)
  };
}

function selectMatch(mod = {}, candidates = []) {
  if (!Array.isArray(candidates)) return { status: 'not_found', candidates: [] };
  const wantedName = normalize(mod.name || mod.title);
  const wantedAuthor = normalize(mod.author);
  const wantedGame = normalize(mod.game);
  const usable = candidates.filter(candidate => candidate && /^[1-9]\d*$/.test(String(candidate.modId || candidate.mod_id || '')) && (!candidate.status || normalize(candidate.status) === 'published') && (!wantedGame || !candidate.game || normalize(candidate.game) === wantedGame));
  const unique = new Map();
  for (const candidate of usable) {
    const id = String(candidate.modId || candidate.mod_id);
    const old = unique.get(id);
    if (old && (normalize(old.name) !== normalize(candidate.name) || normalize(old.author) !== normalize(candidate.author))) return { status: 'multiple_matches', reason: 'conflicting_metadata', candidates: usable.slice(0, 10).map(publicCandidate) };
    unique.set(id, candidate);
  }
  const ranked = [...unique.values()]
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  // Scores rank suggestions; they cannot override identity or a truncated search.
  if (candidates.search?.complete === false) return { status: 'multiple_matches', reason: 'search_incomplete', candidates: ranked.slice(0, 10).map(publicCandidate) };
  if (!ranked.length) return { status: 'not_found', candidates: [] };
  const exactName = ranked.filter(candidate => !wantedName || normalize(candidate.name) === wantedName);
  const exactBoth = exactName.filter(candidate => !wantedAuthor || normalize(candidate.author) === wantedAuthor);

  if (exactBoth.length === 1) return { status: 'found', candidate: exactBoth[0] };
  if (exactBoth.length > 1) return { status: 'multiple_matches', candidates: exactBoth.map(publicCandidate) };
  if (wantedAuthor && !ranked.some(candidate => normalize(candidate.author) === wantedAuthor)) {
    return { status: 'not_found', reason: 'author_mismatch', candidates: ranked.slice(0, 10).map(publicCandidate) };
  }
  return { status: 'multiple_matches', reason: 'name_requires_confirmation', candidates: ranked.slice(0, 10).map(publicCandidate) };
}

function verifyModIdentity(mod, metadata) {
  if (!metadata || typeof metadata !== 'object') return { status: 'needs_review', reason: 'mod_unavailable', candidates: [] };
  const candidate = publicCandidate({ ...metadata, modId: metadata.modId || metadata.mod_id || mod.nexusModId, game: metadata.game || mod.game });
  if (!candidate.name || (metadata.status && normalize(metadata.status) !== 'published')) return { status: 'needs_review', reason: 'mod_unavailable', candidates: [candidate] };
  const conflicts = [];
  if (mod.name && normalize(mod.name) !== normalize(candidate.name)) conflicts.push('name');
  if (mod.author && normalize(mod.author) !== normalize(candidate.author)) conflicts.push('author');
  if (mod.game && candidate.game && normalize(mod.game) !== normalize(candidate.game)) conflicts.push('game');
  if (mod.nexusModId && String(mod.nexusModId) !== String(candidate.modId)) conflicts.push('modId');
  return conflicts.length ? { status: 'needs_review', reason: 'identity_conflict', conflicts, candidates: [candidate] } : { status: 'found', candidate };
}

module.exports = { normalize, publicCandidate, selectMatch, verifyModIdentity };
