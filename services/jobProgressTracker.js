const stateMachine = require('./jobStateMachine');
const schema = require('./modJobSchema');

class JobProgressTracker {
  constructor() {
    this.jobs = new Map();
  }

  create(mod) {
    const job = schema.createModJob(mod);
    this.jobs.set(job.id, job);
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
    if (!job || !job.stages) return null;

    const target = job.stages.find(item => item.name === step);
    if (!target) return null;

    target.status = status;
    const completed = job.stages.filter(item => item.status === 'done').length;
    job.progress = Math.round((completed / job.stages.length) * 100);

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
