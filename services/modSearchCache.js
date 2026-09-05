// Cache layer for discovered mods.
// Stores found Nexus metadata before download/build stages.

const cache = new Map();

function save(key, data) {
  cache.set(key.toLowerCase(), {
    ...data,
    cachedAt: new Date().toISOString()
  });
}

function get(key) {
  return cache.get(String(key).toLowerCase()) || null;
}

function all() {
  return Array.from(cache.values());
}

module.exports = {
  save,
  get,
  all
};
