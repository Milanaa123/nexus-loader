const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const { path7za } = require('7zip-bin');
const { safeArchivePath, archiveType, prepareSource, cleanupPreparedSource } = require('../lib/archive-utils');
const { buildReadyMod } = require('../lib/build-pipeline');

async function run() {
  assert.throws(() => safeArchivePath('../escape.txt'), /Unsafe archive entry/);
  assert.throws(() => safeArchivePath('/absolute.txt'), /Unsafe archive entry/);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-loader-archive-test-'));
  try {
    const zipPath = path.join(root, 'source.zip');
    const zip = new AdmZip();
    zip.addFile('folder/file.txt', Buffer.from('zip-ok'));
    zip.writeZip(zipPath);
    assert.strictEqual(archiveType(zipPath), 'zip');
    const preparedZip = await prepareSource(zipPath, 'test-zip');
    assert.strictEqual(fs.readFileSync(path.join(preparedZip.dir, 'folder', 'file.txt'), 'utf8'), 'zip-ok');
    const zipTemp = preparedZip.dir;
    cleanupPreparedSource(preparedZip);
    assert.strictEqual(fs.existsSync(zipTemp), false);

    if (process.platform !== 'win32') fs.chmodSync(path7za, 0o755);
    const sevenSource = path.join(root, 'seven.txt');
    const sevenPath = path.join(root, 'source.7z');
    fs.writeFileSync(sevenSource, '7z-ok');
    const created = spawnSync(path7za, ['a', '-y', sevenPath, sevenSource], { encoding: 'utf8' });
    assert.strictEqual(created.status, 0, created.stderr || created.stdout);
    const prepared7z = await prepareSource(sevenPath, 'test-7z');
    assert.strictEqual(fs.readFileSync(path.join(prepared7z.dir, 'seven.txt'), 'utf8'), '7z-ok');
    cleanupPreparedSource(prepared7z);

    const originalDir = path.join(root, 'original');
    const translationDir = path.join(root, 'translation');
    const outputDir = path.join(root, 'output');
    fs.mkdirSync(originalDir);
    fs.mkdirSync(translationDir);
    fs.writeFileSync(path.join(originalDir, 'base.txt'), 'base');
    fs.writeFileSync(path.join(originalDir, 'same.txt'), 'original');
    fs.writeFileSync(path.join(translationDir, 'ru.txt'), 'ru');
    fs.writeFileSync(path.join(translationDir, 'same.txt'), 'translation');
    const built = await buildReadyMod({ game: 'any-nexus-game', name: 'Universal Test', originalPath: originalDir, translationPath: translationDir, outputDir });
    assert.strictEqual(fs.existsSync(originalDir), true, 'builder must never delete source directories');
    assert.strictEqual(fs.existsSync(translationDir), true, 'builder must never delete translation directories');
    assert.strictEqual(built.archive.readable, true);
    assert.strictEqual(built.archive.nonEmpty, true);
    assert.strictEqual(built.overwritten, 1);
    assert.strictEqual(built.gameAdapter, 'generic');
    const resultZip = new AdmZip(built.output);
    assert.strictEqual(resultZip.readAsText('same.txt'), 'translation');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run().then(() => console.log('archive utils test passed')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
