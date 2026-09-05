const { getNextJobs, updateStatus } = require('./processQueue');

function prepareBatch(limit = 20) {
  const jobs = getNextJobs(limit);

  const statuses = {};
  for (const job of jobs) {
    statuses[job.name] = 'processing';
  }

  if (jobs.length) {
    updateStatus(statuses);
  }

  return jobs;
}

function completeBatch(jobs = []) {
  const statuses = {};

  for (const job of jobs) {
    statuses[job.name] = 'completed';
  }

  if (jobs.length) {
    updateStatus(statuses);
  }

  return jobs.length;
}

module.exports = { prepareBatch, completeBatch };
