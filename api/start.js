const fs = require('fs');
const path = require('path');

function clean(line) {
  return String(line || '').trim();
}

function isIgnored(line) {
  return !line || line.startsWith('(') || line.startsWith('[') || line.startsWith('#');
}

function isCategory(line) {
  const categories = ['Expansions','NPCs','Frameworks','Maps','Gameplay','Visuals','UI','Items','Animals','Buildings'];
  return categories.includes(line);
}

function parseMods(text) {
  const lines = text.split(/\r?\n/).map(clean);
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];
    if (isIgnored(name)) continue;

    const author = lines[i + 1];
    const category = lines[i + 2];

    if (!author || isIgnored(author)) continue;

    // A real record has: name -> author -> category
    if (category && isCategory(category)) {
      result.push({
        name,
        author,
        category,
        done:false,
        status:'waiting'
      });
      i += 2;
    }
  }

  return result;
}

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const listFile = path.join(root, 'моды(3).txt');
  const queueFile = path.join(root, 'queue.json');

  if (!fs.existsSync(listFile)) {
    return res.status(404).json({ ok:false, error:'моды(3).txt not found' });
  }

  const queue = parseMods(fs.readFileSync(listFile, 'utf8'));

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  fs.writeFileSync(path.join(root, 'worker-state.json'), JSON.stringify({
    running:true,
    total:queue.length,
    remaining:queue.length,
    startedAt:new Date().toISOString()
  }, null, 2));

  return res.json({
    ok:true,
    total:queue.length,
    expected:'530',
    queueCreated:true,
    message:'Mod list parsed with strict records'
  });
};
