const importer = require('./bulkImportService');
const tracker = require('./jobProgressTracker');

class ModWorkflowOrchestrator {
  importList(text) {
    const mods = importer.parse ? importer.parse(text) : [];

    return mods.map(mod => tracker.create({
      name: mod.name,
      author: mod.author
    }));
  }

  getProgress() {
    return tracker.all();
  }
}

module.exports = new ModWorkflowOrchestrator();
