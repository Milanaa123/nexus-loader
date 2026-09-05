// Central catalog for discovered mods.
// Stores normalized mod information and prepares it for persistent storage.

function normalizeMod(mod) {
  return {
    name: String(mod.name || '').trim(),
    author: String(mod.author || '').trim(),
    nexusId: mod.nexusId || null,
    version: mod.version || null,
    ruStatus: mod.ruStatus || 'unknown',
    status: mod.status || 'new'
  };
}

function createCatalogEntry(mod) {
  return {
    ...normalizeMod(mod),
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  normalizeMod,
  createCatalogEntry
};
