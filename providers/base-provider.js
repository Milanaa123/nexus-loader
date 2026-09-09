function notImplemented(name) {
  return async () => {
    throw new Error(`${name} is not implemented by this provider`);
  };
}

function createProvider(input = {}) {
  const id = String(input.id || '').trim();
  if (!id) throw new Error('Provider id is required');

  const provider = {
    id,
    search: typeof input.search === 'function' ? input.search : async () => [],
    getMod: typeof input.getMod === 'function' ? input.getMod : notImplemented('getMod'),
    download: typeof input.download === 'function' ? input.download : notImplemented('download'),
    validate: typeof input.validate === 'function' ? input.validate : async () => true,
    capabilities: Object.freeze({
      search: typeof input.search === 'function',
      getMod: typeof input.getMod === 'function',
      download: typeof input.download === 'function',
      validate: typeof input.validate === 'function'
    })
  };

  return Object.freeze(provider);
}

module.exports = { createProvider };
