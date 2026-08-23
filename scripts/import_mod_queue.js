const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'input', 'mods_for_render_530.csv');
const OUT = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const PROGRESS = path.join(ROOT, 'RU_PACK_WORK', 'progress.json');

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines.shift().split(delimiter).map(x => x.trim().replace(/^"|"$/g, ''));
  return lines.map(line => {
    const cols = line.split(delimiter).map(x => x.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => row[h] = cols[i] || '');
    return row;
  });
}

function run() {
  if (!fs.existsSync(INPUT)) throw new Error('input/mods_for_render_530.csv missing');
  const rows = parseCsv(fs.readFileSync(INPUT, 'utf8'));
  const items = rows.filter(r => r['Название'] || r['name'] || r['Название мода'])
    .map(r => ({
      name: r['Название'] || r['name'] || r['Название мода'],
      author: r['Автор'] || r['author'] || '',
      category: r['Категория'] || r['category'] || '',
      status: 'pending'
    }));

  if (!items.length) throw new Error('CSV parsed but no mods found');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({items}, null, 2));
  fs.writeFileSync(PROGRESS, JSON.stringify({running:false,total:items.length,processed:0,remaining:items.length,downloaded:0,failed:0,current:null}, null, 2));
  console.log(JSON.stringify({ok:true,total:items.length}));
}

run();
