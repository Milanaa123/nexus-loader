const { createJob } = require('./modJobSchema');

function createBatchJobs(mods = []) {
  return mods.map((mod) => createJob({
    name: mod.name,
    author: mod.author,
    status: 'queued',
    steps: [
      'search_nexus',
      'download_original',
      'find_translation',
      'merge_translation',
      'validate',
      'export'
    ]
  }));
}

module.exports = { createBatchJobs };
