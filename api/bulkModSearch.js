const { parseInput } = require('../lib/input-parser');
require('../providers/nexus-provider');
const { getProvider } = require('../providers/provider-registry');

function normalized(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function selectMatch(mod, candidates) {
  if (!candidates.length) return { status: 'not_found' };
  const name = normalized(mod.name);
  const author = normalized(mod.author);
  const exact = candidates.filter(candidate => {
    const nameMatches = !name || normalized(candidate.name) === name;
    const authorMatches = !author || normalized(candidate.author) === author;
    return nameMatches && authorMatches;
  });
  if (exact.length === 1) return { status: 'found', candidate: exact[0] };
  if (exact.length > 1) return { status: 'multiple_matches', candidates: exact };
  if (candidates.length === 1 && candidates[0].score >= 60) return { status: 'found', candidate: candidates[0] };
  return { status: 'multiple_matches', candidates };
}

module.exports = async function bulkModSearch(req, res) {
  const body = req.body || {};
  const text = body.text || body.mods || '';
  const defaultGame = body.game || req.query?.game || null;
  const mods = parseInput(text, { defaultGame });
  const provider = getProvider('nexus');
  if (!provider) return res.status(500).json({ ok: false, error: 'nexus_provider_unavailable' });
  const results = [];
  for (const mod of mods) {
    if (!mod.game) { results.push({ ...mod, status: 'needs_review', error: 'game_required' }); continue; }
    try {
      if (mod.nexusModId) {
        const metadata = await provider.getMod({ game: mod.game, modId: mod.nexusModId });
        results.push({ ...mod, name: mod.name || metadata.name || '', author: mod.author || metadata.author || '', status: 'found', nexusName: metadata.name || null, nexusAuthor: metadata.author || null });
        continue;
      }
      const candidates = await provider.search({ game: mod.game, name: mod.name, author: mod.author, limit: 40 });
      const selected = selectMatch(mod, candidates);
      if (selected.status === 'found') {
        const candidate = selected.candidate;
        results.push({ ...mod, status: 'found', nexusModId: candidate.modId, nexusName: candidate.name, nexusAuthor: candidate.author, score: candidate.score });
      } else if (selected.status === 'multiple_matches') results.push({ ...mod, status: 'multiple_matches', candidates: selected.candidates.slice(0, 10) });
      else results.push({ ...mod, status: 'not_found' });
    } catch (error) {
      results.push({ ...mod, status: 'error', error: error.message });
    }
  }
  return res.json({
    ok: true,
    total: results.length,
    found: results.filter(item => item.status === 'found').length,
    multiple: results.filter(item => item.status === 'multiple_matches').length,
    notFound: results.filter(item => item.status === 'not_found').length,
    needsReview: results.filter(item => item.status === 'needs_review').length,
    errors: results.filter(item => item.status === 'error').length,
    results
  });
};
