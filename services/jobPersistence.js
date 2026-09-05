const storage = new Map();

class JobPersistence {
  save(job) {
    storage.set(job.id || `${job.name}:${job.author}`, {
      ...job,
      savedAt: new Date().toISOString()
    });

    return storage.get(job.id || `${job.name}:${job.author}`);
  }

  get(id) {
    return storage.get(id);
  }

  all() {
    return Array.from(storage.values());
  }

  remove(id) {
    return storage.delete(id);
  }
}

module.exports = new JobPersistence();
