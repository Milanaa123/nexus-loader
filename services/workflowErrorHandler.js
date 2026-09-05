function createError(stage, error) {
  return {
    stage,
    message: error?.message || String(error),
    timestamp: new Date().toISOString()
  };
}

function failJob(job, stage, error) {
  return {
    ...job,
    status: 'failed',
    error: createError(stage, error),
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  createError,
  failJob
};
