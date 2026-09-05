/**
 * Lightweight mod database layer.
 *
 * Stores normalized information about discovered mods.
 * Can later be replaced with SQLite/PostgreSQL without changing
 * the application flow.
 */

const mods = new Map();

function saveMod(mod) {
  const record = {
    name: mod.name,
    author: mod.author,
    nexusId: mod.nexusId || null,
    ruStatus: mod.ruStatus || "unknown",
    updatedAt: new Date().toISOString()
  };

  mods.set(`${record.name}:${record.author}`.toLowerCase(), record);
  return record;
}

function getMod(name, author) {
  return mods.get(`${name}:${author}`.toLowerCase()) || null;
}

function getAllMods() {
  return Array.from(mods.values());
}

module.exports = {
  saveMod,
  getMod,
  getAllMods
};
