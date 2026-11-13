const client = require('../providers/nexus-client');
const { verifyModIdentity } = require('../lib/mod-matcher');
const { findTranslation } = require('../scripts/find-translation');

module.exports = async function translationSearch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const body = req.body || {};
  const game = typeof body.game === 'string' ? body.game.trim().toLowerCase() : '';
  const modId = String(body.modId || '');
  if (!/^[a-z0-9_-]+$/.test(game) || !/^[1-9]\d*$/.test(modId)) return res.status(400).json({ ok: false, error: 'game_and_mod_id_required' });
  try {
    const signal = AbortSignal.timeout(require('../config/nexus').configuration().previewBudgetMs);
    const metadata = await client.getMod({ game, modId, signal });
    const verified = verifyModIdentity({ game, nexusModId: modId, name: typeof body.name === 'string' ? body.name : '', author: typeof body.author === 'string' ? body.author : '' }, metadata);
    if (verified.status !== 'found') return res.json({ ok: true, ...verified });
    const match = await findTranslation({ game, modId, modName: verified.candidate.name, author: verified.candidate.author, signal });
    return res.json({ ok: true, ...(match || { status: 'translation_missing', game, originalModId: modId }) });
  } catch (error) {
    const safe = error.code?.startsWith('NEXUS_');
    return res.status(safe && error.statusCode === 404 ? 404 : safe && error.code === 'NEXUS_AUTH_REQUIRED' ? 401 : 503).json({
      ok: false, status: 'error', error: safe ? error.message : 'Translation search failed',
      errorCode: safe ? error.code : 'NEXUS_SEARCH_FAILED', retryAfterMs: safe ? error.retryAfterMs || null : null,
      candidates: safe ? error.candidates || [] : [], search: safe ? error.search || null : null
    });
  }
};
