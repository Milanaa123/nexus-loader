// Unified job schema for bulk mod processing.
// Keeps the same structure for search, download, translation and export stages.

const STAGES = [
  'queued',
  'search_nexus',
  'download_original',
  'find_translation',
  'merge_translation',
  'validate',
  'export'
];

function createModJob(mod) {
  return {
    id: `${Date.now()}-${mod.name}`,
    name: mod.name,
    author: mod.author,
    status: 'queued',
    stage: 'queued',
    nexusId: null,
    translation: null,
    error: null,
    stages: STAGES.map(stage => ({
      name: stage,
      status: stage === 'queued' ? 'pending' : 'waiting'
    }))
  };
}

module.exports = {
  STAGES,
  createModJob
};
