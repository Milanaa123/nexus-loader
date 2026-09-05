const stateMachine = require('./jobStateMachine');

class JobProgressTracker {
  constructor() {
    this.jobs = new Map();
  }

  create(mod) {
    const id = `${mod.name}:${mod.author}`;
    const job = {
      id,
      mod,
      status: stateMachine.STATUSES.CREATED,
      progress: 0,
      history: [
        { status: stateMachine.STATUSES.CREATED, at: new Date().toISOString() }
      ],
      steps: {
        search: 'pending',
        download_original: 'pending',
        find_translation: 'pending',
        merge_translation: 'pending',
        validate: 'pending',
        export: 'pending'
      },
      errors: []
    };

    this.jobs.set(id, job);
    return job;
  }

  restore(job) {
    if (!job || !job.id) return null;
    this.jobs.set(job.id, job);
    return job;
  }

  restoreAll(jobs = []) {
    jobs.forEach(job => this.restore(job));
    return this.all();
  }

  transition(id, nextStatus) {
    const job = this.jobs.get(id);
    if (!job) return null;

    const updated = stateMachine.move(job, nextStatus);
    updated.history = [
      ...(job.history || []),
      { status: nextStatus, at: updated.updatedAt }
    ];

    this.jobs.set(id, updated);
    return updated;
  }

  fail(id, error) {
    const job = this.jobs.get(id);
    if (!job) return null;

    job.errors.push({
      message: error.message || String(error),
      at: new Date().toISOString()
    });

    if (job.status !== stateMachine.STATUSES.FAILED) {
      return this.transition(id, stateMachine.STATUSES.FAILED);
    }

    return job;
  }

  updateStep(id, step, status) {
    const job = this.jobs.get(id);
    if (!job || !job.steps[step]) return null;

    job.steps[step] = status;
    const completed = Object.values(job.steps).filter(v => v === 'done').length;
    job.progress = Math.round((completed / Object.keys(job.steps).length) * 100);

    return job;
  }

  get(id) {
    return this.jobs.get(id);
  }

  all() {
    return [...this.jobs.values()];
  }
}

module.exports = new JobProgressTracker();
