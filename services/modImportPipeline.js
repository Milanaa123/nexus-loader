const { saveJob } = require('./bulkQueueStorage');

function createImportTasks(mods) {
  return mods.map((mod, index) => saveJob({
    id: `mod-${Date.now()}-${index}`,
    name: mod.name,
    author: mod.author,
    status: 'queued',
    steps: [
      'search',
      'download_original',
      'find_translation',
      'merge_translation',
      'validate',
      'export'
    ]
  }));
}

module.exports = {
  createImportTasks
};
