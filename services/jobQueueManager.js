// Job queue foundation for large-scale mod processing.
// Keeps processing states for future workers.

const jobs = new Map();

function createJob(mod) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    mod,
    status: 'queued',
    steps: {
      search: 'pending',
      download: 'pending',
      translation: 'pending',
      merge: 'pending',
      validation: 'pending',
      export: 'pending'
    }
  };
  jobs.set(id, job);
  return job;
}

function getJobs() {
  return [...jobs.values()];
}

function updateJob(id, changes) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, changes);
  return job;
}

module.exports = {
  createJob,
  getJobs,
  updateJob
};
