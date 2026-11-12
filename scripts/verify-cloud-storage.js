const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');
const AdmZip = require('adm-zip');
const paths = require('../config/paths');
const { cloudConfig } = require('../config/cloud');
const { createSupabaseStore } = require('../lib/supabase-store');
const { digestFile } = require('../lib/file-integrity');
const { validateArchiveFile } = require('../lib/archive-utils');

async function main(args = process.argv.slice(2)) {
  const mode = args.includes('--roundtrip') ? 'roundtrip' : args.includes('--restore') ? 'restore' : 'probe';
  let config;
  if (args.includes('--stdin')) {
    // Automation can supply a single line on a non-echoing pipe, not in argv, files or logs.
    const input = readline.createInterface({ input: process.stdin, terminal: false });
    const line = await new Promise((resolve, reject) => {
      input.once('line', resolve);
      input.once('close', () => reject(new Error('Credential input was not supplied')));
    });
    input.close(); process.stdin.pause();
    const data = JSON.parse(line);
    config = cloudConfig({ NEXUS_LOADER_SUPABASE_URL: data.url, NEXUS_LOADER_STORAGE_TOKEN: data.token });
  }
  const client = createSupabaseStore({ config });
  const health = await client.health();
  if (mode === 'probe') return { ok: true, schema: health.schema, authenticated: true };
  let asset;
  if (mode === 'roundtrip') {
    const file = paths.cloudAssetPath('originals', '_verification/storage-' + crypto.randomUUID() + '.zip');
    fs.mkdirSync(paths.restorePaths(file, 'unused').directory, { recursive: true });
    const zip = new AdmZip();
    zip.addFile('verification.txt', Buffer.from('Nexus Loader private storage verification. Not a game mod.\n'));
    zip.addFile('binary-fixture.bin', crypto.randomBytes(2097223));
    zip.writeZip(file);
    asset = await client.uploadFile(file);
    await client.update('verification', value => {
      value.history = [...(value.history || []), { archive: asset, at: new Date().toISOString() }];
      value.latest = asset;
    });
  } else {
    asset = (await client.read('verification')).value.latest;
    if (!asset) throw new Error('No stored verification archive; run an explicit roundtrip first');
  }
  const file = await client.restoreFile(asset);
  const valid = await validateArchiveFile(file);
  const matched = await digestFile(file) === asset.sha256;
  if (!matched || !valid.readable || !valid.nonEmpty) throw new Error('Cloud archive roundtrip verification failed');
  return { ok: true, mode, bytes: asset.size, chunks: asset.chunks.length, sha256Matches: matched, archiveReadable: true, localFile: file };
}
if (require.main === module) main().then(value => console.log(JSON.stringify(value))).catch(failure => {
  console.error(JSON.stringify({ ok: false, code: failure.code || 'VERIFICATION_FAILED', error: failure.message }));
  process.exitCode = 1;
});
module.exports = { main };
