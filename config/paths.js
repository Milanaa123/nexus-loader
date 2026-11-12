const path = require('path');

const root = path.resolve(process.env.NEXUS_LOADER_ROOT || path.join(__dirname, '..'));
const workDir = path.resolve(process.env.RU_PACK_WORK || path.join(root, 'RU_PACK_WORK'));
const queueDir = path.resolve(process.env.RU_PACK_QUEUE || path.join(workDir, 'queue'));
const stateDir = path.resolve(process.env.RU_PACK_STATE || path.join(workDir, 'state'));
const driveTransfersDir = path.join(stateDir, 'drive-transfers');

module.exports = Object.freeze({
  root, workDir, queueDir, stateDir,
  outputDir: path.resolve(process.env.RU_PACK_OUTPUT || path.join(workDir, 'builds')),
  originalsDir: path.resolve(process.env.RU_PACK_ORIGINALS || path.join(workDir, 'originals')),
  translationsDir: path.resolve(process.env.RU_PACK_TRANSLATIONS || path.join(workDir, 'translations')),
  downloadsDir: path.resolve(process.env.RU_PACK_DOWNLOADS || path.join(workDir, 'downloads')),
  tempDir: path.resolve(process.env.RU_PACK_TEMP || path.join(workDir, 'temp')),
  logsDir: path.resolve(process.env.RU_PACK_LOGS || path.join(workDir, 'logs')),
  queueFile: path.resolve(process.env.RU_PACK_QUEUE_FILE || path.join(queueDir, 'ru-pack-queue.json')),
  progressFile: path.join(stateDir, 'progress.json'),
  processedFile: path.join(stateDir, 'processed.json'),
  resultsFile: path.join(stateDir, 'results.json'),
  errorsFile: path.join(stateDir, 'errors.json'),
  healthFile: path.join(stateDir, 'health.json'),
  driveTransfersDir,
  driveTransferFile: key => path.join(driveTransfersDir, key + '.json'),
  driveTransferLockFile: key => path.join(driveTransfersDir, key + '.lease'),
  driveRestorePaths: (destination, token) => ({
    directory: path.dirname(destination),
    partial: path.join(path.dirname(destination), '.' + path.basename(destination) + '.drive-' + token + '.partial')
  }),
  workerLockFile: path.resolve(process.env.NEXUS_LOADER_WORKER_LOCK_FILE || path.join(stateDir, 'worker.lock')),
  legacyStateDir: path.join(root, 'data', 'state'),
  legacyQueueFile: path.join(root, 'data', 'queue', 'ru-pack-queue.json'),
  legacyProgressFile: path.join(workDir, 'progress.json'),
  legacyResultsFile: path.join(workDir, 'ru_results.json'),
  legacyOutputDir: path.join(workDir, 'output')
});
