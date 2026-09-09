function safeName(value = 'mod') {
  return String(value || 'mod').replace(/[^a-z0-9а-яё_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'mod';
}

module.exports = {
  id: 'generic',
  name: 'Generic Nexus Game Adapter',
  mergeStrategy: 'overlay',

  detect(files = []) {
    return Array.isArray(files) && files.length > 0;
  },

  validate(files = []) {
    return { valid: Array.isArray(files) && files.length > 0, files };
  },

  validateSource({ files = [] } = {}) {
    return {
      valid: Array.isArray(files) && files.length > 0,
      fileCount: Array.isArray(files) ? files.length : 0,
      warnings: []
    };
  },

  getTranslationTargets(files = []) {
    return files.filter(file => {
      const name = String(file).toLowerCase();
      return name.includes('lang') || name.includes('local') || name.includes('strings') || name.includes('i18n') || name.endsWith('.json');
    });
  },

  outputName({ name } = {}) {
    return `${safeName(name)}_RU.zip`;
  }
};
