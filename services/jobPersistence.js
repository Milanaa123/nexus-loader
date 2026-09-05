const storage = new Map();

class JobPersistence {
  save(job) {
    const key = job.id || `${job.name}:${job.author}`;
    const saved = {
      ...job,
      savedAt: new Date().toISOString()
    };

    storage.set(key, saved);
    return saved;
  }

  restore(id) {
    return storage.get(id) || null;
  }

  restoreAll() {
    return Array.from(storage.values());
  }

  saveAll(jobs) {
    jobs.forEach(job => this.save(job));
    return this.restoreAll();
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

  clear() {
    storage.clear();
  }
}

module.exports = new JobPersistence();
