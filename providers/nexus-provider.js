const { createProvider } = require('./base-provider');

module.exports = createProvider({
  id: 'nexus',

  async search(query) {
    return [];
  },

  async download() {
    throw new Error('Nexus download adapter requires existing downloader integration');
  },

  async validate() {
    return true;
  }
});
