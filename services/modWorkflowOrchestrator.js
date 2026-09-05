const importer = require('./bulkImportService');
const tracker = require('./jobProgressTracker');
const stateMachine = require('./jobStateMachine');

class ModWorkflowOrchestrator {
  importList(text) {
    const mods = importer.parse ? importer.parse(text) : [];

    return mods.map(mod => tracker.create({
      name: mod.name,
      author: mod.author,
      status: stateMachine.STATUSES.CREATED,
      history: [stateMachine.STATUSES.CREATED],
      errors: []
    }));
  }

  advance(job, nextStatus) {
    const updated = stateMachine.move(job, nextStatus);
    updated.history = [...(job.history || []), nextStatus];
    return tracker.update(updated);
  }

  fail(job, error) {
    return tracker.update({
      ...job,
      status: stateMachine.STATUSES.FAILED,
      errors: [...(job.errors || []), String(error)],
      updatedAt: new Date().toISOString()
    });
  }

  getProgress() {
    return tracker.all();
  }
}

module.exports = new ModWorkflowOrchestrator();
