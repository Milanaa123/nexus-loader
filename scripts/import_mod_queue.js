const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'input', 'mods_for_render_530.csv');
const OUT = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const PROGRESS = path.join(ROOT, 'RU_PACK_WORK', 'progress.json');

function clean(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^"|"$/g, '');
}

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines.shift().split(delimiter).map(clean);

  return lines.map(line => {
    const cols = line.split(delimiter).map(clean);
    const row = {};
    headers.forEach((h, i) => row[h] = cols[i] || '');
    return row;
  });
}

function pick(row, names) {
  for (const name of names) {
    if (row[name]) return clean(row[name]);
  }
  return '';
}

function run() {
  if (!fs.existsSync(INPUT)) throw new Error('input/mods_for_render_530.csv missing');

  const rows = parseCsv(fs.readFileSync(INPUT, 'utf8'));
  const seen = new Set();

  const items = rows
    .map(row => ({
      name: pick(row, ['Название', 'name', 'Название мода']),
      author: pick(row, ['Автор', 'author']),
      category: pick(row, ['Категория', 'category']),
      status: 'pending'
    }))
    .filter(item => item.name)
    .filter(item => {
      const key = `${item.name.toLowerCase()}|${item.author.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!items.length) throw new Error('CSV parsed but no mods found');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });

  fs.writeFileSync(OUT, JSON.stringify({items}, null, 2));
  fs.writeFileSync(PROGRESS, JSON.stringify({
    running:false,
    total:items.length,
    processed:0,
    remaining:items.length,
    downloaded:0,
    failed:0,
    current:null
  }, null, 2));

  console.log(JSON.stringify({ok:true,total:items.length}));
}

run();
