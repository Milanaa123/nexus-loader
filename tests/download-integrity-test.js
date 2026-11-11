const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-download-integrity-'));
  process.env.NEXUS_LOADER_ROOT = root;
  process.env.RU_PACK_WORK = path.join(root, 'work');
  const client = require('../providers/nexus-client');
  const original = { getFiles: client.getFiles, getDownloadLinks: client.getDownloadLinks, request: client.request };
  const { downloadMod, validCachedFile } = require('../scripts/nexus-downloader');
  const { validateArchiveFile } = require('../lib/archive-utils');
  const paths = require('../config/paths');
  const zip = new AdmZip();
  zip.addFile('Mod/ru.txt', Buffer.from('Русский текст'));
  const good = zip.toBuffer();
  let requests = 0;
  let mode = 'truncated-first';
  client.getFiles = async ({ modId }) => [{ file_id: modId, file_name: 'mod-' + modId + '.zip', is_primary: true }];
  client.getDownloadLinks = async () => [{ URI: 'https://example.invalid/test' }];
  client.request = async () => {
    requests += 1;
    if (mode === 'html') return new Response('<html>Access denied</html>', { headers: { 'content-type': 'text/html' } });
    if (mode === 'broken') return new Response(Buffer.from('not a ZIP'), { headers: { 'content-type': 'application/zip' } });
    const body = mode === 'truncated-first' && requests === 1 ? good.subarray(0, 20) : good;
    return new Response(body, { headers: { 'content-type': 'application/zip', 'content-length': String(good.length) } });
  };
  try {
    const first = await downloadMod({ game: 'stardewvalley', modId: '1', role: 'original' });
    assert.strictEqual(requests, 2, 'body truncation must retry the whole transfer');
    assert.ok(first.path.startsWith(paths.originalsDir + path.sep));
    assert.strictEqual(first.size, good.length);
    assert.ok(await validCachedFile(first.path));
    assert.strictEqual(JSON.parse(fs.readFileSync(first.path + '.meta.json', 'utf8')).sha256, first.sha256);
    const cached = await downloadMod({ game: 'stardewvalley', modId: '1', role: 'original' });
    assert.strictEqual(cached.cached, true);
    assert.strictEqual(requests, 2);

    fs.writeFileSync(first.path, 'damaged archive');
    assert.strictEqual(await validCachedFile(first.path), false);
    const repair = await downloadMod({ game: 'stardewvalley', modId: '1', role: 'original' });
    assert.notStrictEqual(repair.path, first.path);
    assert.ok(await validCachedFile(repair.path));
    assert.strictEqual(fs.readFileSync(first.path, 'utf8'), 'damaged archive');

    mode = 'html';
    const beforeHtml = requests;
    await assert.rejects(() => downloadMod({ game: 'stardewvalley', modId: '2', role: 'translation' }), /error document/);
    assert.strictEqual(requests, beforeHtml + 1);
    assert.deepStrictEqual(fs.readdirSync(paths.translationsDir), []);

    mode = 'broken';
    await assert.rejects(() => downloadMod({ game: 'stardewvalley', modId: '3', role: 'translation' }), /archive is invalid/);
    assert.deepStrictEqual(fs.readdirSync(paths.translationsDir), []);
    await assert.rejects(() => downloadMod({ game: '../escape', modId: '4' }), /game domain/);
    await assert.rejects(() => downloadMod({ game: 'stardewvalley', modId: '../4' }), /Invalid Nexus modId/);

    const crcFile = path.join(root, 'bad-crc.zip');
    const corrupted = Buffer.from(good);
    const offset = 30 + corrupted.readUInt16LE(26) + corrupted.readUInt16LE(28);
    corrupted[offset] ^= 0xff;
    fs.writeFileSync(crcFile, corrupted);
    assert.strictEqual((await validateArchiveFile(crcFile)).readable, false, 'valid central directory must not hide a damaged payload');
    assert.ok(!fs.readdirSync(paths.originalsDir).some(name => name.includes('.partial-')));
  } finally {
    Object.assign(client, original);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) run().then(() => console.log('download integrity test passed (truncation, cache, checksum, corrupt ZIP, HTML, paths)')).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = run;
