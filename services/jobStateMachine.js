const STATUSES = {
  CREATED: 'created',
  QUEUED: 'queued',
  SEARCH: 'search',
  DOWNLOAD: 'download',
  TRANSLATION: 'translation',
  MERGE: 'merge',
  VALIDATION: 'validation',
  EXPORT: 'export',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const FLOW = {
  created: ['queued'],
  queued: ['search'],
  search: ['download', 'failed'],
  download: ['translation', 'failed'],
  translation: ['merge', 'failed'],
  merge: ['validation', 'failed'],
  validation: ['export', 'failed'],
  export: ['completed', 'failed'],
  completed: [],
  failed: ['queued']
};

function canMove(from, to) {
  return FLOW[from]?.includes(to) ?? false;
}

function move(job, nextStatus) {
  if (!canMove(job.status, nextStatus)) {
    throw new Error(`Invalid job transition: ${job.status} -> ${nextStatus}`);
  }

  return {
    ...job,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  STATUSES,
  canMove,
  move
};
