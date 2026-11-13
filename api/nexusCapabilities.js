const client = require('../providers/nexus-client');
const { configuration } = require('../config/nexus');

module.exports = async function nexusCapabilities(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const value = await client.getCapabilities({ signal: AbortSignal.timeout(configuration().previewBudgetMs) });
    return res.json({ ok: true, authenticated: value.authenticated === true, directDownloads: value.directDownloads === true, requiresWebsiteAuthorization: value.requiresWebsiteAuthorization === true });
  } catch (error) {
    const known = error.code?.startsWith('NEXUS_');
    return res.status(error.code === 'NEXUS_AUTH_REQUIRED' ? 401 : 503).json({ ok: false, error: known ? error.message : 'Nexus capability check failed', errorCode: known ? error.code : 'NEXUS_CAPABILITY_CHECK_FAILED' });
  }
};
