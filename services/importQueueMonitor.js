class ImportQueueMonitor {
  constructor() {
    this.batches = [];
  }

  register(batch) {
    this.batches.push({
      id: batch.id,
      status: 'queued',
      createdAt: new Date().toISOString()
    });
    return this.batches[this.batches.length - 1];
  }

  update(id, status) {
    const batch = this.batches.find(item => item.id === id);
    if (!batch) return null;
    batch.status = status;
    batch.updatedAt = new Date().toISOString();
    return batch;
  }

  getAll() {
    return this.batches;
  }
}

module.exports = ImportQueueMonitor;
