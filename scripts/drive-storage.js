const { configurationStatus } = require('../config/storage');
const { createDriveStore } = require('../lib/google-drive-store');

async function main(args = process.argv.slice(2)) {
  const [command = 'status', ...parameters] = args;
  if (command === 'status' && !parameters.length) return configurationStatus();
  if (command === 'probe' && !parameters.length) return createDriveStore().probe();
  if (command === 'put' && parameters.length === 1) return createDriveStore().putFile(parameters[0]);
  if (command === 'get' && parameters.length === 4) {
    const [fileId, sha256, size, destination] = parameters;
    return createDriveStore().getFile({ fileId, sha256, size: Number(size) }, destination);
  }
  const error = new Error('Usage: npm run storage:drive -- status | probe | put <file> | get <fileId> <sha256> <bytes> <new-destination>');
  error.code = 'DRIVE_USAGE';
  throw error;
}

if (require.main === module) main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(JSON.stringify({ ok: false, code: error.code || 'DRIVE_LOCAL_ERROR', error: error.message }));
  process.exitCode = 1;
});

module.exports = { main };
