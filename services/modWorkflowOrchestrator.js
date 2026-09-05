const importer = require('./bulkImportService');
const tracker = require('./jobProgressTracker');
const persistence = require('./jobPersistence');
const schema = require('./modJobSchema');
const validator = require('./jobValidator');

class ModWorkflowOrchestrator {
  importList(text) {
    const mods = importer.parse ? importer.parse(text) : [];

    return mods.map(mod => {
      const job = schema.createModJob(mod);
      const check = validator.validateJob(job);

      if (!check.valid) {
        job.errors.push(...check.errors.map(message => ({ message })));
      }

      tracker.restore(job);
      persistence.save(job);
      return job;
    });
  }

  advance(job, nextStatus) {
    const updated = tracker.transition(job.id, nextStatus);
    persistence.save(updated);
    return updated;
  }

  fail(job, error) {
    const updated = tracker.fail(job.id, error);
    persistence.save(updated);
    return updated;
  }

  restore() {
    const jobs = persistence.restoreAll();
    tracker.restoreAll(jobs);
    return tracker.all();
  }

  saveAll() {
    return persistence.saveAll(tracker.all());
  }

  getProgress() {
    return tracker.all();
  }
}

module.exports = new ModWorkflowOrchestrator();
