const fs = require('fs');

/**
 * Builds a processing plan for a found Nexus mod.
 * Execution workers can consume these steps later.
 */
function createBuildPlan(mod) {
  return {
    name: mod.name,
    author: mod.author,
    nexusId: mod.modId || null,
    createdAt: new Date().toISOString(),
    steps: [
      { id: 'download_original', status: 'pending' },
      { id: 'find_translation', status: 'pending' },
      { id: 'merge_translation', status: 'pending' },
      { id: 'validate', status: 'pending' },
      { id: 'export_archive', status: 'pending' }
    ]
  };
}

function savePlans(plans, file = 'RU_PACK_WORK/build_queue.json') {
  fs.mkdirSync('RU_PACK_WORK', { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plans, null, 2));
  return file;
}

module.exports = { createBuildPlan, savePlans };
