const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const AdmZip = require('adm-zip');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-worker-recovery-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const paths = require('../config/paths');
  const queue = require('../lib/job-queue');
  const state = require('../lib/state-store');
  const { createWorker, validBuiltResult } = require('../scripts/ru-pack-worker');
  const { buildReadyMod } = require('../lib/build-pipeline');
  const { acquireWorkerLock } = require('../lib/worker-lock');
  let clock = Date.now();
  let downloads = 0;
  let searches = 0;
  let failTranslation = true;
  const provider = {
    id: 'nexus', capabilities: { search: true },
    async search() { return [{ modId: '10', name: 'Example', author: 'Author', score: 180 }]; },
    async validate(file) { return Boolean(file.path && fs.existsSync(file.path)); },
    async download({ modId, role }) {
      downloads += 1;
      if (role === 'translation' && failTranslation) throw new Error('Temporary translation failure');
      const directory = role === 'original' ? paths.originalsDir : paths.translationsDir;
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, modId + '.zip');
      const zip = new AdmZip();
      zip.addFile('Example/' + (role === 'original' ? 'base.txt' : 'ru.txt'), Buffer.from(role));
      zip.writeZip(file);
      return { path: file };
    }
  };
  const settings = {
    provider, now: () => clock, retryBaseMs: 1000, maxAttempts: 2,
    translationFinder: async () => { searches += 1; return { translationId: '99' }; },
    builder: buildReadyMod
  };
  try {
    queue.addJobs([{ name: 'Example', author: 'Author', game: 'stardewvalley' }]);
    const key = queue.load()[0].key;
    await createWorker(settings).start();
    let result = state.getResults()[0];
    assert.strictEqual(result.status, 'error');
    assert.ok(fs.existsSync(result.originalFile));
    assert.strictEqual(result.attempts, 1);
    assert.strictEqual(downloads, 2);
    assert.strictEqual(state.getProgress().status, 'waiting_retry');
    assert.ok(Date.parse(result.nextAttemptAt) > clock);

    // A second process sees the checkpoint before a retry starts.
    const persisted = JSON.parse(execFileSync(process.execPath, ['-e', "console.log(JSON.stringify(require('./lib/state-store').getResults()[0]))"], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' }));
    assert.strictEqual(persisted.originalFile, result.originalFile);
    await createWorker(settings).start();
    assert.strictEqual(downloads, 2, 'retry must wait until the persisted time');

    clock += 1001;
    failTranslation = false;
    await createWorker(settings).start();
    result = state.getResults()[0];
    assert.strictEqual(result.status, 'built');
    assert.strictEqual(result.key, key, 'resolved modId must not change queue identity');
    assert.strictEqual(downloads, 3, 'original must be reused after retry');
    assert.strictEqual(searches, 1, 'translation selection must be reused');
    assert.ok(await validBuiltResult(result));
    assert.strictEqual(queue.load().length, 1);
    assert.strictEqual(queue.load()[0].status, 'built');
    assert.strictEqual(state.getProgress().remaining, 0);

    await createWorker(settings).start();
    assert.strictEqual(downloads, 3, 'verified terminal jobs must be skipped');
    assert.strictEqual(state.getResults().length, 1);

    const previousOutput = result.outputFile;
    fs.writeFileSync(previousOutput, 'damaged');
    await createWorker(settings).start();
    const rebuilt = state.getResults()[0];
    assert.ok(await validBuiltResult(rebuilt));
    assert.notStrictEqual(rebuilt.outputFile, previousOutput);
    assert.strictEqual(fs.readFileSync(previousOutput, 'utf8'), 'damaged', 'previous artifacts must not be erased');
    assert.strictEqual(downloads, 3);

    queue.addJobs([{ name: 'Broken', author: 'Author', game: 'stardewvalley', nexusModId: '20' }]);
    const failing = createWorker({ ...settings, translationFinder: async () => { throw new Error('network failed'); } });
    await failing.start();
    clock += 1001;
    await failing.start();
    assert.strictEqual(state.getResults().find(x => x.name === 'Broken').status, 'retry_exhausted');
    const errorCount = state.getErrors().length;
    await failing.start();
    assert.strictEqual(state.getErrors().length, errorCount, 'exhausted jobs must not retry automatically');

    const held = acquireWorkerLock();
    const before = state.getProgress();
    await assert.rejects(() => createWorker(settings).start(), error => error.code === 'WORKER_BUSY');
    assert.deepStrictEqual(state.getProgress(), before);
    held.release();

    // Kill a real process while it holds both lock types; the next local process recovers them.
    const child = spawn(process.execPath, ['-e',
      "require('./lib/worker-lock').acquireWorkerLock();" +
      "require('./lib/file-store').withFileLock(require('./config/paths').queueFile,()=>{" +
      "process.stdout.write('locked'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30000);});"
    ], { cwd: path.join(__dirname, '..'), env: process.env });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.stdout.once('data', resolve);
      child.once('exit', code => { if (code) reject(new Error('Lock child failed')); });
    });
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await ended;
    queue.addJobs([{ name: 'After crash', author: 'A', game: 'stardewvalley', nexusModId: '30' }]);
    const recovered = acquireWorkerLock();
    recovered.release();
    const processingChild = spawn(process.execPath, ['-e',
      "const fs=require('fs'),path=require('path'),Zip=require('adm-zip'),p=require('./config/paths');" +
      "require('./scripts/ru-pack-worker').createWorker({provider:{id:'nexus',download:async({role})=>{" +
      "if(role==='translation'){process.stdout.write('source-checkpointed');await new Promise(r=>setTimeout(r,30000));}" +
      "fs.mkdirSync(p.originalsDir,{recursive:true});const f=path.join(p.originalsDir,'crash-source.zip');" +
      "const z=new Zip();z.addFile('Crash/base.txt',Buffer.from('original'));z.writeZip(f);return {path:f};}}," +
      "translationFinder:async()=>({translationId:'100'})}).start().catch(e=>{console.error(e);process.exitCode=1;});"
    ], { cwd: path.join(__dirname, '..'), env: process.env });
    await new Promise((resolve, reject) => {
      processingChild.once('error', reject);
      processingChild.stdout.once('data', resolve);
      processingChild.once('exit', code => { if (code) reject(new Error('Processing child failed')); });
    });
    const checkpoint = state.getResults().find(x => x.name === 'After crash');
    assert.strictEqual(checkpoint.status, 'original_downloaded');
    assert.ok(fs.existsSync(checkpoint.originalFile));
    const processingEnded = new Promise(resolve => processingChild.once('exit', resolve));
    processingChild.kill('SIGKILL');
    await processingEnded;
    const beforeResumeDownloads = downloads;
    await createWorker(settings).start();
    assert.strictEqual(state.getResults().find(x => x.name === 'After crash').status, 'built');
    assert.strictEqual(downloads, beforeResumeDownloads + 1, 'after SIGKILL only the missing translation should download');
    assert.ok(fs.existsSync(paths.logsDir));
    assert.ok(fs.readdirSync(paths.logsDir).some(name => name.endsWith('.jsonl')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) run().then(() => console.log('worker recovery test passed (checkpoints, retries, rebuild, process kill, leases)')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
