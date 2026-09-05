// Validation layer for unified mod jobs.

const REQUIRED_FIELDS = [
  'id',
  'mod',
  'status',
  'progress',
  'stages',
  'errors'
];

function validateJob(job) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in job)) {
      errors.push(`Missing field: ${field}`);
    }
  }

  if (!job.mod || !job.mod.name || !job.mod.author) {
    errors.push('Invalid mod identity');
  }

  if (typeof job.progress !== 'number' || job.progress < 0 || job.progress > 100) {
    errors.push('Invalid progress value');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateJob
};
