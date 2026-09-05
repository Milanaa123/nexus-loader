// Persistent-ready storage abstraction for bulk mod processing.
// Current implementation keeps data in memory and defines the contract
// for future SQLite/PostgreSQL storage.

const jobs = new Map();

function saveJob(job) {
  jobs.set(job.id, {
    ...job,
    updatedAt: new Date().toISOString()
  });
  return jobs.get(job.id);
}

function getJob(id) {
  return jobs.get(id) || null;
}

function getAllJobs() {
  return Array.from(jobs.values());
}

module.exports = {
  saveJob,
  getJob,
  getAllJobs
};
