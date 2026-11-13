const { parseInput } = require('../lib/input-parser');
require('../providers/nexus-provider');
const { getProvider } = require('../providers/provider-registry');
const { selectMatch, verifyModIdentity } = require('../lib/mod-matcher');

module.exports = async function bulkModSearch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const body = req.body || {};
  const text = body.text || body.mods || '';
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ ok: false, error: 'input_text_required' });
  const defaultGame = body.game || req.query?.game || null;
  const mods = parseInput(text, { defaultGame });
  const config = require('../config/nexus').configuration();
  if (mods.length > config.maxBulkSearchItems) return res.status(413).json({ ok: false, error: 'search_batch_too_large', limit: config.maxBulkSearchItems });
  const signal = AbortSignal.timeout(config.previewBudgetMs);
  const provider = getProvider('nexus');
  if (!provider) return res.status(500).json({ ok: false, error: 'nexus_provider_unavailable' });
  const results = [];
  let stopped = null;
  for (const mod of mods) {
    if (!mod.game) { results.push({ ...mod, status: 'needs_review', error: 'game_required' }); continue; }
    try {
      if (stopped) throw stopped;
      if (mod.nexusModId) {
        const metadata = await provider.getMod({ game: mod.game, modId: mod.nexusModId, signal });
        const verified = verifyModIdentity(mod, metadata);
        results.push({ ...mod, ...verified, candidate: undefined, ...(verified.status === 'found' ? { name: verified.candidate.name, author: verified.candidate.author, nexusName: verified.candidate.name, nexusAuthor: verified.candidate.author } : {}) });
        continue;
      }
      const candidates = await provider.search({ game: mod.game, name: mod.name, author: mod.author, limit: 40, signal });
      const selected = selectMatch(mod, candidates);
      if (selected.status === 'found') {
        const candidate = selected.candidate;
        results.push({ ...mod, status: 'found', nexusModId: candidate.modId, nexusName: candidate.name, nexusAuthor: candidate.author, score: candidate.score });
      } else results.push({ ...mod, ...selected });
    } catch (error) {
      if (['NEXUS_RATE_LIMIT', 'NEXUS_AUTH_REQUIRED', 'NEXUS_GRAPHQL', 'NEXUS_CONFIG', 'NEXUS_CANCELLED'].includes(error.code)) stopped = error;
      results.push({ ...mod, status: error.code === 'NEXUS_NOT_FOUND' ? 'not_found' : 'error', error: error.code?.startsWith('NEXUS_') ? error.message : 'Nexus lookup failed', errorCode: error.code || null, retryAfterMs: error.retryAfterMs || null });
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
