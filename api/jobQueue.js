const fs = require('fs');
const paths = require('../config/paths');

const FILE = paths.queueFile;

function ensureDir() {
  fs.mkdirSync(paths.queueDir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    const broken = `${FILE}.broken`;
    try {
      fs.renameSync(FILE, broken);
    } catch (_) {}
    return [];
  }
}

function save(queue) {
  ensureDir();
  const temp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(queue, null, 2), 'utf8');
  fs.renameSync(temp, FILE);
}

function addJobs(mods = []) {
  const queue = load();
  const existing = new Set(queue.map(x => `${x.name}|${x.author}`));

  for (const mod of mods) {
    const key = `${mod.name}|${mod.author}`;
    if (!existing.has(key)) {
      queue.push({
        name: mod.name || null,
        author: mod.author || null,
        modId: mod.modId || mod.nexusModId || null,
        translation: null,
        status: 'queued',
        createdAt: new Date().toISOString()
      });
      existing.add(key);
    }
  }

  save(queue);
  return queue;
}

module.exports = { load, save, addJobs };
