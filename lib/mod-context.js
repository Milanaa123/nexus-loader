class ModContext {
  constructor(input = {}) {
    this.id = input.id || null;
    this.game = input.game || 'unknown';
    this.provider = input.provider || null;
    this.source = input.source || null;
    this.files = Array.isArray(input.files) ? input.files : [];
    this.metadata = input.metadata || {};
    this.status = input.status || 'created';
    this.errors = Array.isArray(input.errors) ? input.errors : [];
  }

  addFile(file) {
    if (file) this.files.push(file);
    return this;
  }

  fail(error) {
    this.status = 'error';
    this.errors.push(String(error?.message || error));
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      game: this.game,
      provider: this.provider,
      source: this.source,
      files: this.files,
      metadata: this.metadata,
      status: this.status,
      errors: this.errors
    };
  }
}

module.exports = { ModContext };
