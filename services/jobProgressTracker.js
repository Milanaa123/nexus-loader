class JobProgressTracker {
  constructor() {
    this.jobs = new Map();
  }

  create(mod) {
    const id = `${mod.name}:${mod.author}`;
    const job = {
      id,
      mod,
      status: 'queued',
      progress: 0,
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
