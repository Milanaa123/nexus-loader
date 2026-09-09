class ModContext {
  constructor(input = {}) {
    this.id = input.id || null;
    this.game = input.game || null;
    this.provider = input.provider || null;
    this.source = input.source || null;
    this.files = Array.isArray(input.files) ? input.files : [];
    this.metadata = input.metadata || {};
    this.status = input.status || 'created';
    this.errors = Array.isArray(input.errors) ? input.errors : [];
    this.steps = Array.isArray(input.steps) ? input.steps : [];
    this.halted = Boolean(input.halted);
    this.haltReason = input.haltReason || null;
  }

  addFile(file) {
    if (file) this.files.push(file);
    return this;
  }

  halt(reason, status) {
    this.halted = true;
    this.haltReason = reason || 'halted';
    if (status) this.status = status;
    return this;
  }

  fail(error) {
    this.status = 'error';
    const message = String(error?.message || error);
    if (message && !this.errors.includes(message)) this.errors.push(message);
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
      errors: this.errors,
      steps: this.steps,
      halted: this.halted,
      haltReason: this.haltReason
    };
  }
}

module.exports = { ModContext };
