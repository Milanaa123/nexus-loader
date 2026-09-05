function validateJob(job) {
  const errors = [];

  if (!job || typeof job !== 'object') {
    return ['job is required'];
  }

  if (!job.id) errors.push('id is required');
  if (!job.mod || !job.mod.name) errors.push('mod name is required');
  if (!job.status) errors.push('status is required');
  if (typeof job.progress !== 'number') errors.push('progress must be a number');

  if (job.progress < 0 || job.progress > 100) {
    errors.push('progress must be between 0 and 100');
  }

  return errors;
}

module.exports = { validateJob };
