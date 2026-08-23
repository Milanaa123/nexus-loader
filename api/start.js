const fs = require('fs');
const path = require('path');

function parseMods(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\(.*\)/.test(line) || line.includes('[')) continue;
    const next = lines[i + 1];
    if (!next) continue;
    if (/^[A-Za-z0-9_\-\.]+$/.test(next) && !next.includes(' ')) {
      result.push({ name: line, author: next, done: false });
      i++;
    }
  }
  return result;
}

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'queue.json');
  const listFile = path.join(root, 'моды(3).txt');

  let queue = [];

  if (fs.existsSync(listFile)) {
    queue = parseMods(fs.readFileSync(listFile, 'utf8'));
    fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  } else if (fs.existsSync(queueFile)) {
    try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch (_) {}
  }

  fs.writeFileSync(path.join(root, 'worker-state.json'), JSON.stringify({
    running: true,
    startedAt: new Date().toISOString(),
    total: queue.length,
    remaining: queue.filter(x => !x.done).length
  }, null, 2));

  return res.json({
    ok: true,
    started: true,
    total: queue.length,
    message: 'Loaded mod list and started translation scan'
  });
};
