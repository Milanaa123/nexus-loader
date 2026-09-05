const { load, save } = require('./jobQueue');

function updateStatus(statuses = {}) {
  const queue = load();

  const updated = queue.map((job) => {
    if (!statuses[job.name]) return job;
    return {
      ...job,
      status: statuses[job.name],
      updatedAt: new Date().toISOString()
    };
  });

  save(updated);
  return updated;
}

function getNextJobs(limit = 20) {
  return load()
    .filter(job => job.status === 'queued')
    .slice(0, limit);
}

module.exports = { getNextJobs, updateStatus };
