const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

function child(script, env = process.env) {
  return new Promise((resolve, reject) => {
    const processChild = spawn(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env });
    let stderr = '';
    processChild.stderr.on('data', chunk => { stderr += chunk; });
    processChild.on('error', reject);
    processChild.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr || 'Child exit ' + code)));
  });
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-storage-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'mounted-volume');
  const paths = require('../config/paths');
  const queue = require('../lib/job-queue');
  const state = require('../lib/state-store');
  const { writeJson } = require('../lib/file-store');
  try {
    assert.ok(paths.queueFile.startsWith(paths.workDir + path.sep));
    assert.ok(paths.progressFile.startsWith(paths.workDir + path.sep));
    assert.ok(paths.outputDir.startsWith(paths.workDir + path.sep));
    assert.ok(paths.workerLockFile.startsWith(paths.workDir + path.sep));

    const legacy = [{ name: 'Legacy', author: 'Author', game: 'stardewvalley' }];
    writeJson(paths.legacyQueueFile, { items: legacy });
    writeJson(path.join(paths.legacyStateDir, 'progress.json'), { processed: 1 });
    writeJson(paths.legacyResultsFile, [{ key: 'legacy', status: 'built' }]);
    assert.strictEqual(queue.load()[0].name, 'Legacy');
    assert.strictEqual(state.getProgress().processed, 1);
    assert.strictEqual(state.getResults()[0].key, 'legacy');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(paths.legacyQueueFile, 'utf8')), { items: legacy });
    assert.ok(fs.existsSync(paths.resultsFile));

    const initial = queue.addJobs([{ name: 'Resolved', author: 'Author', game: 'stardewvalley' }]);
    const originalKey = initial.items.find(x => x.name === 'Resolved').key;
    queue.updateJob(originalKey, { nexusModId: '123', status: 'built' });
    queue.addJobs([{ name: 'Resolved', author: 'Author', game: 'stardewvalley' }]);
    queue.addJobs([{ nexusModId: '123', game: 'stardewvalley' }]);
    const resolved = queue.load().filter(x => x.nexusModId === '123');
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].key, originalKey);
    assert.strictEqual(resolved[0].status, 'built');

    // API inserts and worker status writes must not overwrite one another.
    await Promise.all(Array.from({ length: 4 }, (_, worker) => child(
      "const q=require('./lib/job-queue');" +
      "for(let i=0;i<30;i++)q.addJobs([{name:'Worker-" + worker + "-'+i,author:'A',game:'stardewvalley'}]);"
    )));
    assert.strictEqual(queue.load().filter(x => x.name.startsWith('Worker-')).length, 120);
    await child("const q=require('./lib/job-queue'); if(q.load().length!==122)process.exit(2);");

    const damaged = '{"items":';
    fs.writeFileSync(paths.queueFile, damaged);
    assert.throws(() => queue.load(), error => error.code === 'STORAGE_CORRUPT');
    assert.throws(() => queue.addJobs([{ name: 'Not lost', author: 'A' }]), error => error.code === 'STORAGE_CORRUPT');
    assert.strictEqual(fs.readFileSync(paths.queueFile, 'utf8'), damaged);

    fs.writeFileSync(paths.errorsFile, '{broken');
    assert.throws(() => state.appendError(new Error('test')), error => error.code === 'STORAGE_CORRUPT');
    assert.strictEqual(fs.readFileSync(paths.errorsFile, 'utf8'), '{broken');

    const env = { ...process.env };
    delete env.NEXUS_LOADER_ROOT;
    delete env.RU_PACK_WORK;
    const modulePath = path.join(__dirname, '..', 'config', 'paths.js');
    const actual = execFileSync(process.execPath, ['-e', "process.chdir(require('os').tmpdir()); console.log(require(" + JSON.stringify(modulePath) + ").root)"], { env, encoding: 'utf8' }).trim();
    assert.strictEqual(actual, path.join(__dirname, '..'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) run().then(() => console.log('persistent storage test passed (migration, restart, 120 concurrent inserts, corruption)')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
