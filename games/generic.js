/**
 * Generic game adapter.
 *
 * Game-specific integrations should extend this contract instead of being
 * hard-coded into the loader pipeline.
 */
module.exports = {
  id: 'generic',
  name: 'Generic Nexus Game Adapter',

  detect(files = []) {
    return files.length > 0;
  },

  validate(files = []) {
    return {
      valid: Array.isArray(files),
      files
    };
  },

  getTranslationTargets(files = []) {
    return files.filter((file) => {
      const name = String(file).toLowerCase();
      return name.includes('lang') || name.includes('local') || name.endsWith('.json');
    });
  }
};
