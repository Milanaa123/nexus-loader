// Compatibility with old NODE_OPTIONS preloads: loading this file is inert.
// An operator can still run this diagnostic explicitly, without logging job data.
async function runAudit({ fetch = globalThis.fetch, port = process.env.PORT || 10000 } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Health audit failed: HTTP ' + response.status);
  const data = await response.json();
  if (data.ok !== true || data.service !== 'nexus-loader') throw new Error('Health audit returned an unexpected service');
  return { ok: true, service: data.service, storage: data.storage?.workspace || null };
}
module.exports = { runAudit };
if (require.main === module) runAudit().then(value => console.log(JSON.stringify(value))).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
