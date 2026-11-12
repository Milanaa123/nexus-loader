const path = require('path');

const root = path.resolve(process.env.NEXUS_LOADER_ROOT || path.join(__dirname, '..'));
const workDir = path.resolve(process.env.RU_PACK_WORK || path.join(root, 'RU_PACK_WORK'));
const queueDir = path.resolve(process.env.RU_PACK_QUEUE || path.join(workDir, 'queue'));
const stateDir = path.resolve(process.env.RU_PACK_STATE || path.join(workDir, 'state'));
const driveTransfersDir = path.join(stateDir, 'drive-transfers');
const artifactAreas = Object.freeze({
  originals: path.resolve(process.env.RU_PACK_ORIGINALS || path.join(workDir, 'originals')),
  translations: path.resolve(process.env.RU_PACK_TRANSLATIONS || path.join(workDir, 'translations')),
  builds: path.resolve(process.env.RU_PACK_OUTPUT || path.join(workDir, 'builds')),
  downloads: path.resolve(process.env.RU_PACK_DOWNLOADS || path.join(workDir, 'downloads')),
  legacyBuilds: path.join(workDir, 'output')
});
function cloudAssetPath(area, name) {
  if (!Object.hasOwn(artifactAreas, area) || typeof name !== 'string' || !name || /[\\\0]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid cloud artifact path');
  const file = path.resolve(artifactAreas[area], name);
  if (!file.startsWith(artifactAreas[area] + path.sep)) throw new Error('Cloud artifact path escapes storage');
  return file;
}
function cloudAssetReference(file) {
  for (const [area, directory] of Object.entries(artifactAreas)) {
    const name = path.relative(directory, path.resolve(file)).split(path.sep).join('/');
    if (name && !name.startsWith('../') && name !== '..' && !path.isAbsolute(name)) {
      if (cloudAssetPath(area, name) === path.resolve(file)) return { area, name };
    }
  }
  throw new Error('Cloud artifact is outside the configured archive directories');
}

module.exports = Object.freeze({
  root, workDir, queueDir, stateDir,
  outputDir: artifactAreas.builds,
  originalsDir: artifactAreas.originals,
  translationsDir: artifactAreas.translations,
  artifactAreas, cloudAssetPath, cloudAssetReference,
  cloudAssetDirectories: (area, name) => {
    cloudAssetPath(area, name);
    return { root: artifactAreas[area], directories: name.split('/').slice(0, -1).map((_, index, parts) => path.resolve(artifactAreas[area], ...parts.slice(0, index + 1))) };
  },
  downloadsDir: artifactAreas.downloads,
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
  cacheQuarantineFile: (file, token) => file + '.corrupt-' + token,
  restorePaths: (destination, token) => ({
    directory: path.dirname(destination),
    partial: path.join(path.dirname(destination), '.' + path.basename(destination) + '.transfer-' + token + '.partial')
  }),
  workerLockFile: path.resolve(process.env.NEXUS_LOADER_WORKER_LOCK_FILE || path.join(stateDir, 'worker.lock')),
  legacyStateDir: path.join(root, 'data', 'state'),
  legacyQueueFile: path.join(root, 'data', 'queue', 'ru-pack-queue.json'),
  legacyProgressFile: path.join(workDir, 'progress.json'),
  legacyResultsFile: path.join(workDir, 'ru_results.json'),
  legacyOutputDir: artifactAreas.legacyBuilds
});
