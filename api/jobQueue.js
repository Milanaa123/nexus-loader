const fs = require('fs');

const FILE = 'RU_PACK_WORK/build_queue.json';

function load() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function save(queue) {
  fs.mkdirSync('RU_PACK_WORK', { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(queue, null, 2));
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
        modId: mod.modId || null,
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
