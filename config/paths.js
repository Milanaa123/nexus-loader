const path = require('path');

const ROOT = process.env.NEXUS_LOADER_ROOT || process.cwd();

module.exports = {
  root: ROOT,
  workDir: process.env.RU_PACK_WORK || path.join(ROOT, 'RU_PACK_WORK'),
  outputDir: process.env.RU_PACK_OUTPUT || path.join(ROOT, 'RU_PACK_WORK', 'output'),
  tempDir: process.env.RU_PACK_TEMP || path.join(ROOT, 'RU_PACK_WORK', 'temp')
};
