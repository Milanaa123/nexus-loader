/**
 * Coordinates the high-level bulk workflow.
 *
 * Input format:
 *   [{ name: 'Alpaca', author: 'aboba24' }]
 *
 * This module intentionally keeps orchestration separate from
 * Nexus API, translation resolver and archive builder implementations.
 */

function createBatchRequest(mods = []) {
  return mods.map((mod) => ({
    id: `${mod.name}:${mod.author}`,
    name: mod.name,
    author: mod.author,
    status: 'queued',
    stages: {
      search: 'pending',
      download: 'pending',
      translation: 'pending',
      merge: 'pending',
      validation: 'pending',
      export: 'pending'
    }
  }));
}

function getBatchSummary(jobs = []) {
  return {
    total: jobs.length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
    queued: jobs.filter((job) => job.status === 'queued').length
  };
}

module.exports = {
  createBatchRequest,
  getBatchSummary
};
