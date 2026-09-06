const providers = new Map();

function registerProvider(provider) {
  if (!provider || !provider.id) {
    throw new Error('Provider must have id');
  }

  providers.set(provider.id, provider);
  return provider;
}

function getProvider(id) {
  return providers.get(id) || null;
}

function listProviders() {
  return [...providers.keys()];
}

module.exports = {
  registerProvider,
  getProvider,
  listProviders
};
