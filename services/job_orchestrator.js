const { validateJob } = require('./job_validator');
const { createJob } = require('./mod_job');

function createModJob(input) {
  const job = createJob(input);
  validateJob(job);
  return job;
}

function updateJobStage(job, stage, progress) {
  if (!job) throw new Error('Job is required');
  if (progress < 0 || progress > 100) throw new Error('Invalid progress');

  job.currentStage = stage;
  job.progress = progress;
  job.updatedAt = new Date().toISOString();

  return job;
}

module.exports = {
  createModJob,
  updateJobStage
};
