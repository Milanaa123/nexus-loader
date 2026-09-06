const { registerProvider } = require('./provider-registry');

function loadProvider(provider) {
  if (!provider) return null;
  return registerProvider(provider);
}

function loadProviders(list = []) {
  return list.filter(Boolean).map(loadProvider);
}

module.exports = {
  loadProvider,
  loadProviders
};
