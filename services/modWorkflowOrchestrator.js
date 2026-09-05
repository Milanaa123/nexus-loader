const importer = require('./bulkImportService');
const tracker = require('./jobProgressTracker');
const persistence = require('./jobPersistence');
const stateMachine = require('./jobStateMachine');

class ModWorkflowOrchestrator {
  importList(text) {
    const mods = importer.parse ? importer.parse(text) : [];

    return mods.map(mod => {
      const job = tracker.create({
        name: mod.name,
        author: mod.author,
        status: stateMachine.STATUSES.CREATED,
        errors: []
      });

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
    return persistence.all();
  }

  getProgress() {
    return tracker.all();
  }
}

module.exports = new ModWorkflowOrchestrator();
