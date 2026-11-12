const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

async function run() {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NEXUS_LOADER_ENABLE_LEGACY_REDIRECT;
  const child = spawnSync(process.execPath, [
    '--require', path.join(root, 'scripts/pkg50-startup-audit.js'),
    '--require', path.join(root, 'scripts/render-fetch-redirect.js'),
    '-e', 'if(global.__renderFetchRedirectInstalled)process.exit(2)'
  ], { env, timeout: 3000, encoding: 'utf8' });
  assert.ifError(child.error);
  assert.strictEqual(child.status, 0, child.stderr);
  assert.strictEqual(child.stdout, '', 'legacy preloads must be inert by default');

  const { runAudit } = require('../scripts/pkg50-startup-audit');
  const audited = await runAudit({ port: 12345, fetch: async (url, options) => {
    assert.strictEqual(url, 'http://127.0.0.1:12345/health');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ ok: true, service: 'nexus-loader', storage: { workspace: 'supabase' }, privateFixture: 'must not be logged' }) };
  } });
  assert.deepStrictEqual(audited, { ok: true, service: 'nexus-loader', storage: 'supabase' });
  await assert.rejects(() => runAudit({ fetch: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);

  // Execute the actual browser script; no duplicate implementation of its scheduling rules.
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const elements = new Map(); const listeners = new Map(); const timers = new Map(); const pending = [];
  let sequence = 0;
  const element = () => ({ textContent: '', className: '', hidden: false, addEventListener() {}, replaceChildren() {}, append() {} });
  const document = {
    hidden: false,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element,
    addEventListener(name, fn) { listeners.set(name, fn); }
  };
  const context = vm.createContext({
    document,
    fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const reply = (index, workspace) => pending[index].resolve({ ok: true, json: async () => ({ storage: { workspace }, queue: { total: 0 }, ready: [] }) });
  vm.runInContext(script, context);
  assert.strictEqual(pending.length, 1);
  await context.refresh();
  assert.strictEqual(pending.length, 1, 'a pending status read must not overlap');
  assert.strictEqual(timers.size, 0);
  reply(0, 'supabase'); await flush();
  assert.strictEqual([...timers.values()][0].ms, 30000);
  document.hidden = true; listeners.get('visibilitychange')();
  assert.strictEqual(timers.size, 0);
  document.hidden = false; listeners.get('visibilitychange')();
  assert.strictEqual(pending.length, 2);
  document.hidden = true; listeners.get('visibilitychange')();
  reply(1, 'supabase'); await flush();
  assert.strictEqual(timers.size, 0, 'a hidden tab must not rearm a timer after a response');
  document.hidden = false; listeners.get('visibilitychange')();
  reply(2, 'local-filesystem'); await flush();
  assert.strictEqual([...timers.values()][0].ms, 5000);
  const refresh = context.refresh();
  pending[3].reject(new Error('offline fixture'));
  await refresh;
  assert.strictEqual([...timers.values()][0].ms, 5000, 'a failed read should retry without an interval leak');
  assert.match(elements.get('progress').textContent, /offline fixture/);
}
if (require.main === module) run().then(() => console.log('runtime startup test passed (inert preloads, explicit audit, cloud/local polling, hidden tabs, overlap, outage)')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
