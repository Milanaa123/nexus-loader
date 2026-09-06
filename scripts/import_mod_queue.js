const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'input', 'mods_for_render_530.csv');
const OUT = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');
const PROGRESS = path.join(ROOT, 'RU_PACK_WORK', 'progress.json');

function clean(value = '') {
  return String(value).replace(/^\uFEFF/, '').trim().replace(/^"|"$/g, '');
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { result.push(clean(current)); current = ''; }
    else current += char;
  }
  result.push(clean(current));
  return result;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitCsvLine(lines.shift(), delimiter);
  return lines.map(line => {
    const cols = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
  });
}

function pick(row, names) {
  for (const name of names) if (row[name]) return clean(row[name]);
  return '';
}

function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function normalizeItem(item) {
  return {
    name: clean(item.name),
    author: clean(item.author),
    category: clean(item.category),
    modId: item.modId || null,
    status: item.status || 'pending'
  };
}

function run() {
  if (!fs.existsSync(INPUT)) throw new Error('input/mods_for_render_530.csv missing');

  const rows = parseCsv(fs.readFileSync(INPUT, 'utf8'));
  const seen = new Set();
  const items = rows.map(row => normalizeItem({
    name: pick(row, ['Название', 'name', 'Название мода']),
    author: pick(row, ['Автор', 'author']),
    category: pick(row, ['Категория', 'category'])
  })).filter(x => x.name).filter(item => {
    const key = `${item.name.toLowerCase()}|${item.author.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!items.length) throw new Error('CSV parsed but no mods found');

  atomicWrite(OUT, {version: 2, updatedAt: new Date().toISOString(), items});
  atomicWrite(PROGRESS, {
    running:false,
    total:items.length,
    processed:0,
    remaining:items.length,
    downloaded:0,
    failed:0,
    current:null,
    queueVersion:2,
    updatedAt:new Date().toISOString()
  });

  console.log(JSON.stringify({ok:true,total:items.length}));
}

run();
