const paths = require('../config/paths');
const { processingKey } = require('./mod-processing-pipeline');
const { readMigrated, readJson, writeJson, withFileLock } = require('./file-store');

const VERSION = 3;
function emptyDocument() { return { version: VERSION, updatedAt: null, items: [] }; }
function validDocument(value) {
  const items = Array.isArray(value) ? value : (value?.items || value?.mods);
  return Array.isArray(items) && items.every(item => item !== null && typeof item === 'object' && !Array.isArray(item));
}
function normalizeDocument(data) {
  return Array.isArray(data)
    ? { version: VERSION, updatedAt: null, items: data }
    : { version: Number(data.version || VERSION), updatedAt: data.updatedAt || null, items: data.items || data.mods };
}
function loadDocument() {
  return normalizeDocument(readMigrated(paths.queueFile, [paths.legacyQueueFile], emptyDocument(), validDocument));
}
function persist(document) {
  return writeJson(paths.queueFile, { version: VERSION, updatedAt: new Date().toISOString(), items: document.items });
}
function transaction(update) {
  loadDocument();
  return withFileLock(paths.queueFile, () => {
    const document = normalizeDocument(readJson(paths.queueFile, emptyDocument(), validDocument));
    const result = update(document);
    persist(document);
    return result;
  });
}
function saveDocument(document) {
  if (!validDocument(document)) throw new Error('Invalid queue document');
  return withFileLock(paths.queueFile, () => persist(normalizeDocument(document)));
}
function load() { return loadDocument().items; }
function save(items) { return saveDocument({ items }).items; }
function clean(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
function identity(item, provider) {
  return processingKey({ ...item, key: undefined }, provider);
}

function addJobs(mods = [], providerId = 'nexus') {
  return transaction(document => {
    let added = 0;
    let updated = 0;
    for (const raw of mods) {
      const provider = clean(raw.provider || providerId).toLowerCase();
      const normalized = {
        name: clean(raw.name || raw.title),
        author: clean(raw.author),
        game: clean(raw.game || raw.gameDomain).toLowerCase() || null,
        nexusModId: clean(raw.nexusModId || raw.modId) || null,
        sourceUrl: raw.sourceUrl || null,
        provider
      };
      if (!normalized.name && !normalized.nexusModId) throw new Error('Mod name or modId is required');
      const canonical = identity(normalized, provider);
      const existing = document.items.find(item =>
        (item.provider || 'nexus') === provider &&
        (item.key === canonical || identity(item, provider) === canonical ||
          (item.game === normalized.game && clean(item.name).toLowerCase() === normalized.name.toLowerCase() &&
           clean(item.author).toLowerCase() === normalized.author.toLowerCase() && normalized.name &&
           (!item.nexusModId || !normalized.nexusModId || String(item.nexusModId) === normalized.nexusModId)))
      );
      if (existing) {
        // Identity/key and terminal statuses survive re-imports and resolved Nexus IDs.
        for (const [field, value] of Object.entries(normalized)) {
          if (value !== null && value !== '') existing[field] = value;
        }
        existing.key = existing.key || canonical;
        existing.updatedAt = new Date().toISOString();
        updated += 1;
      } else {
        document.items.push({ ...normalized, key: canonical, status: 'queued', attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        added += 1;
      }
    }
    return { items: document.items, added, updated };
  });
}

function updateJob(key, patch = {}) {
  if (!key) return null;
  return transaction(document => {
    const index = document.items.findIndex(item => item.key === key || identity(item, item.provider || 'nexus') === key);
    if (index < 0) return null;
    const current = document.items[index];
    const next = { ...current, ...patch, key: current.key || key, updatedAt: new Date().toISOString() };
    document.items[index] = next;
    return next;
  });
}

function stats() {
  const items = load();
  const statuses = {};
  for (const item of items) statuses[item.status || 'queued'] = (statuses[item.status || 'queued'] || 0) + 1;
  return { total: items.length, statuses };
}
module.exports = { VERSION, loadDocument, saveDocument, load, save, addJobs, updateJob, stats };
