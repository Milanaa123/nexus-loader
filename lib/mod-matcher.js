function normalize(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function publicCandidate(candidate = {}) {
  return {
    modId: candidate.modId || candidate.mod_id || null,
    name: candidate.name || '',
    author: candidate.author || '',
    version: candidate.version || null,
    game: candidate.game || null,
    score: Number(candidate.score || 0)
  };
}

function selectMatch(mod = {}, candidates = [], options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return { status: 'not_found', candidates: [] };
  const minSingleScore = Number(options.minSingleScore || 60);
  const minAutoScore = Number(options.minAutoScore || 120);
  const minGap = Number(options.minGap || 30);
  const wantedName = normalize(mod.name || mod.title);
  const wantedAuthor = normalize(mod.author);
  const ranked = [...candidates].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const exactName = ranked.filter(candidate => !wantedName || normalize(candidate.name) === wantedName);
  const exactBoth = exactName.filter(candidate => !wantedAuthor || normalize(candidate.author) === wantedAuthor);

  if (exactBoth.length === 1) return { status: 'found', candidate: exactBoth[0] };
  if (exactBoth.length > 1) return { status: 'multiple_matches', candidates: exactBoth.map(publicCandidate) };
  if (!wantedAuthor && exactName.length === 1) return { status: 'found', candidate: exactName[0] };
  if (ranked.length === 1 && Number(ranked[0].score || 0) >= minSingleScore) return { status: 'found', candidate: ranked[0] };

  const first = ranked[0];
  const second = ranked[1];
  const gap = Number(first?.score || 0) - Number(second?.score || 0);
  if (first && Number(first.score || 0) >= minAutoScore && (!second || gap >= minGap)) return { status: 'found', candidate: first };
  return { status: 'multiple_matches', candidates: ranked.slice(0, 10).map(publicCandidate) };
}

module.exports = { normalize, publicCandidate, selectMatch };
