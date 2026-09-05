const crypto = require('crypto');

const STATUSES = [
  'created',
  'queued',
  'searching',
  'downloading',
  'translating',
  'merging',
  'validating',
  'completed',
  'failed'
];

function createModJob({ name, author }) {
  if (!name) throw new Error('mod name is required');

  return {
    id: crypto.randomUUID(),
    mod: {
      name,
      author: author || ''
    },
    status: 'created',
    progress: 0,
    stages: [],
    errors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function canMove(from, to) {
  if (from === to) return true;
  if (to === 'failed') return true;

  const order = {
    created: 0,
    queued: 1,
    searching: 2,
    downloading: 3,
    translating: 4,
    merging: 5,
    validating: 6,
    completed: 7
  };

  return order[to] !== undefined && order[to] > order[from];
}

function updateStatus(job, status) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  if (!canMove(job.status, status)) throw new Error(`invalid transition ${job.status} -> ${status}`);

  job.status = status;
  job.updatedAt = new Date().toISOString();
  job.stages.push({ status, time: job.updatedAt });
  return job;
}

module.exports = {
  STATUSES,
  createModJob,
  updateStatus
};
