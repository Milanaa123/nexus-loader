function configuration(env = process.env) {
  const fail = () => { throw Object.assign(new Error('Nexus configuration is invalid'), { code: 'NEXUS_CONFIG', retryable: false }); };
  const endpoint = value => {
    let url; try { url = new URL(value); } catch { fail(); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail();
    return url.href.replace(/\/$/, '');
  };
  const timeoutMs = Number(env.NEXUS_LOADER_REQUEST_TIMEOUT_MS || 60000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) fail();
  return {
    apiV1: endpoint(env.NEXUS_API_V1 || 'https://api.nexusmods.com/v1'),
    graphql: endpoint(env.NEXUS_GRAPHQL || 'https://api.nexusmods.com/v2/graphql'),
    timeoutMs, attempts: 3, maxJsonBytes: 8388608, maxRetryDelayMs: 3000,
    previewBudgetMs: 45000, maxBulkSearchItems: 25
  };
}
module.exports = { configuration };
