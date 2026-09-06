const { createProvider } = require('./base-provider');
const nexusDownloader = require('../scripts/nexus-downloader');

module.exports = createProvider({
  id: 'nexus',

  async search(query) {
    if (!query) return [];
    return [];
  },

  async download(options = {}) {
    return nexusDownloader.downloadMod({
      game: options.game,
      modId: options.modId,
      fileId: options.fileId
    });
  },

  async validate(file) {
    return Boolean(file && file.path);
  }
});
