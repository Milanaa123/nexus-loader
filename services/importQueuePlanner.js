function planImportQueue(jobs, options = {}) {
  const batchSize = options.batchSize || 50;
  const queue = [];

  for (let index = 0; index < jobs.length; index += batchSize) {
    queue.push({
      id: queue.length + 1,
      jobs: jobs.slice(index, index + batchSize),
      size: Math.min(batchSize, jobs.length - index)
    });
  }

  return {
    totalJobs: jobs.length,
    batches: queue.length,
    queue
  };
}

module.exports = {
  planImportQueue
};
