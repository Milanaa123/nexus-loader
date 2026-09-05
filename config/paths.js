const path = require('path');

const ROOT = process.env.NEXUS_LOADER_ROOT || process.cwd();
const WORK_DIR = process.env.RU_PACK_WORK || path.join(ROOT, 'RU_PACK_WORK');

module.exports = {
  root: ROOT,
  workDir: WORK_DIR,
  outputDir: process.env.RU_PACK_OUTPUT || path.join(WORK_DIR, 'output'),
  tempDir: process.env.RU_PACK_TEMP || path.join(WORK_DIR, 'temp'),
  queueDir: process.env.RU_PACK_QUEUE || path.join(ROOT, 'data', 'queue'),
  queueFile: process.env.RU_PACK_QUEUE_FILE || path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json')
};
