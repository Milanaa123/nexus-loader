function canTransition(from, to) {
  const transitions = {
    created: ['queued', 'failed'],
    queued: ['searching', 'failed'],
    searching: ['downloading', 'failed'],
    downloading: ['patching', 'failed'],
    patching: ['completed', 'failed'],
    completed: [],
    failed: ['queued']
  };

  return Array.isArray(transitions[from]) && transitions[from].includes(to);
}

function transition(job, nextStatus) {
  if (!job || !job.status) {
    throw new Error('Invalid job');
  }

  if (!canTransition(job.status, nextStatus)) {
    throw new Error(`Invalid transition ${job.status} -> ${nextStatus}`);
  }

  return {
    ...job,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  canTransition,
  transition
};
