const fs = require('fs');
const paths = require('../config/paths');
const { processingKey } = require('./mod-processing-pipeline');

const VERSION = 3;

function ensureDir() { fs.mkdirSync(paths.queueDir, { recursive: true }); }
function emptyDocument() { return { version: VERSION, updatedAt: null, items: [] }; }

function loadDocument() {
  ensureDir();
  if (!fs.existsSync(paths.queueFile)) return emptyDocument();
  try {
    const data = JSON.parse(fs.readFileSync(paths.queueFile, 'utf8'));
    if (Array.isArray(data)) return { version: VERSION, updatedAt: null, items: data };
    return { version: Number(data.version || VERSION), updatedAt: data.updatedAt || null, items: Array.isArray(data.items) ? data.items : (Array.isArray(data.mods) ? data.mods : []) };
  } catch (error) {
    const broken = `${paths.queueFile}.broken-${Date.now()}`;
    try { fs.renameSync(paths.queueFile, broken); } catch (_) {}
    return { ...emptyDocument(), recoveredFrom: broken, error: error.message };
  }
}

function saveDocument(document) {
  ensureDir();
  const value = { version: VERSION, updatedAt: new Date().toISOString(), items: Array.isArray(document.items) ? document.items : [] };
  const temp = `${paths.queueFile}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, paths.queueFile);
  return value;
}

function load() { return loadDocument().items; }
function save(items) { return saveDocument({ items }).items; }

function addJobs(mods = [], providerId = 'nexus') {
  const document = loadDocument();
  const items = document.items;
  const byKey = new Map(items.map(item => [item.key || processingKey(item, item.provider || providerId), item]));
  let added = 0;
  let updated = 0;

  for (const raw of mods) {
    const provider = raw.provider || providerId;
    const normalized = {
      name: raw.name || raw.title || '',
      author: raw.author || '',
      game: raw.game || raw.gameDomain || null,
      nexusModId: raw.nexusModId || raw.modId || null,
      sourceUrl: raw.sourceUrl || null,
      provider
    };
    const key = processingKey(normalized, provider);
    const existing = byKey.get(key);
    if (existing) {
      const merged = { ...existing, ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== null && value !== '')), key, updatedAt: new Date().toISOString() };
      const index = items.indexOf(existing);
      items[index] = merged;
      byKey.set(key, merged);
      updated += 1;
      continue;
    }
    const job = { ...normalized, key, status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    items.push(job);
    byKey.set(key, job);
    added += 1;
  }
  saveDocument({ items });
  return { items, added, updated };
}

function updateJob(key, patch = {}) {
  if (!key) return null;
  const document = loadDocument();
  const index = document.items.findIndex(item => item.key === key || processingKey(item, item.provider || 'nexus') === key);
  if (index < 0) return null;
  const current = document.items[index];
  const next = { ...current, ...patch, key: current.key || key, updatedAt: new Date().toISOString() };
  document.items[index] = next;
  saveDocument(document);
  return next;
}

function stats() {
  const items = load();
  const statuses = {};
  for (const item of items) statuses[item.status || 'queued'] = (statuses[item.status || 'queued'] || 0) + 1;
  return { total: items.length, statuses };
}

module.exports = { VERSION, loadDocument, saveDocument, load, save, addJobs, updateJob, stats };
