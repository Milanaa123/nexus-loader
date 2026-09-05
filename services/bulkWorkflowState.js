// Bulk workflow state manager foundation.
// Keeps processing state separate from UI and API layers.

const states = new Map();

const WORKFLOW_STAGES = [
  "queued",
  "search",
  "download_original",
  "find_translation",
  "merge_translation",
  "validate",
  "export",
  "completed",
  "failed"
];

function createJob(mod) {
  const id = `${mod.name}:${mod.author}`;
  const job = {
    id,
    name: mod.name,
    author: mod.author,
    stage: "queued",
    createdAt: new Date().toISOString()
  };

  states.set(id, job);
  return job;
}

function updateJob(id, stage, extra = {}) {
  const job = states.get(id);
  if (!job) return null;

  if (WORKFLOW_STAGES.includes(stage)) {
    job.stage = stage;
  }

  Object.assign(job, extra);
  return job;
}

function getJobs() {
  return Array.from(states.values());
}

module.exports = {
  WORKFLOW_STAGES,
  createJob,
  updateJob,
  getJobs
};
