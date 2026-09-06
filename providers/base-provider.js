function createProvider(input = {}) {
  return {
    id: input.id || 'unknown',
    search: input.search || (async () => []),
    download: input.download || (async () => {
      throw new Error('download is not implemented');
    }),
    validate: input.validate || (async () => true)
  };
}

module.exports = {
  createProvider
};
