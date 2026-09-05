// Unified job schema for bulk mod processing.
// Single structure for search, download, translation, merge, validation and export.

const STAGES = [
  'search_nexus',
  'download_original',
  'find_translation',
  'merge_translation',
  'validate',
  'export'
];

function createModJob(mod = {}) {
  return {
    id: `${Date.now()}-${mod.name || 'unknown'}`,
    mod: {
      name: mod.name || '',
      author: mod.author || ''
    },
    status: 'created',
    progress: 0,
    nexus: {
      id: null,
      version: null,
      files: []
    },
    translation: {
      found: false,
      source: null,
      version: null
    },
    stages: STAGES.map(stage => ({
      name: stage,
      status: 'pending'
    })),
    result: {
      archive: null,
      ready: false
    },
    history: [],
    errors: []
  };
}

module.exports = {
  STAGES,
  createModJob
};
