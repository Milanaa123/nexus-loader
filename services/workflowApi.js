// Workflow API foundation for bulk mod processing.
// Provides a stable layer for connecting UI requests with queue processing.

const state = require('./bulkWorkflowState');

function getWorkflowStatus() {
  return {
    total: state.getJobs().length,
    jobs: state.getJobs()
  };
}

module.exports = {
  getWorkflowStatus
};
