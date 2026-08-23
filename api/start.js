const fs = require('fs');
const path = require('path');

function parseMods(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const result = [];

  for (let i = 0; i < lines.length;) {
    const name = lines[i++];
    if (!name || name.startsWith('#') || name.startsWith('[')) continue;

    const author = lines[i] || '';
    if (author) i++;

    let category = '';
    if (lines[i] && !lines[i].startsWith('http') && !lines[i].startsWith('#')) {
      category = lines[i++];
    }

    result.push({
      name,
      author,
      category,
      done: false,
      status: 'queued'
    });
  }

  return result;
}

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'queue.json');
  const listFile = path.join(root, 'моды(3).txt');

  if (!fs.existsSync(listFile)) {
    return res.status(404).json({ ok:false, error:'моды(3).txt not found' });
  }

  const queue = parseMods(fs.readFileSync(listFile, 'utf8'));
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

  fs.writeFileSync(path.join(root, 'worker-state.json'), JSON.stringify({
    running: true,
    total: queue.length,
    processed: 0,
    remaining: queue.length,
    startedAt: new Date().toISOString()
  }, null, 2));

  return res.json({
    ok:true,
    total: queue.length,
    queueCreated:true,
    message:'Loaded mods from mod list'
  });
};
