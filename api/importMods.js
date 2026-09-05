const fs = require('fs');
const path = require('path');
const { workDir } = require('../config/paths');

const GAME = 'stardewvalley';

async function nexus(url) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');
  const r = await fetch(url, { headers: { apikey: key, 'x-api-key': key } });
  if (!r.ok) throw new Error(`Nexus ${r.status}`);
  return r.json();
}

function clean(value = '') {
  return String(value).replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
}

function csvLine(line) {
  const result = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { result.push(current); current = ''; }
    else current += c;
  }
  result.push(current);
  return result.map(clean);
}

function parseMods(text, format = 'auto') {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const result = [];
  const isCsv = format === 'csv' || (format === 'auto' && lines[0]?.toLowerCase().includes('name,author'));

  if (isCsv) {
    for (const line of lines.slice(1)) {
      const [name, author] = csvLine(line);
      if (name) result.push({ name, author: author || '' });
    }
  } else {
    for (const line of lines) {
      const parts = line.split(/\s{2,}|\t/).map(clean).filter(Boolean);
      if (parts.length >= 2) result.push({ name: parts[0], author: parts[1] });
    }
  }

  const unique = new Map();
  for (const item of result) {
    const key = `${item.name.toLowerCase()}\u0000${item.author.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

module.exports = async function(req, res) {
  if (req.query.action !== 'start') return res.json({ ok:false, error:'use action=start' });

  const source = path.join(process.cwd(), req.query.file || 'mods.txt');
  if (!fs.existsSync(source)) return res.json({ ok:false, error:`input not found: ${source}` });

  const mods = parseMods(fs.readFileSync(source, 'utf8'), req.query.format || 'auto');
  const queue = [];

  for (const modData of mods) {
    const item = { ...modData, nexusModId: null, status: 'not_found', error: null };
    try {
      const found = await nexus(`https://api.nexusmods.com/v1/games/${GAME}/mods.json?search=${encodeURIComponent(modData.name)}`);
      const candidates = Array.isArray(found) ? found : [];
      const matched = candidates.filter(x => !modData.author || String(x.author || '').toLowerCase().includes(modData.author.toLowerCase()));
      if (matched.length === 1 || (matched.length === 0 && candidates.length === 1)) {
        const mod = matched[0] || candidates[0];
        item.nexusModId = mod.mod_id;
        item.status = 'found';
      } else if (matched.length > 1 || candidates.length > 1) {
        item.status = 'multiple_matches';
        item.candidates = candidates.slice(0, 10).map(x => ({ id:x.mod_id, name:x.name, author:x.author }));
      }
    } catch (e) {
      item.status = 'error';
      item.error = e.message;
    }
    queue.push(item);
  }

  fs.mkdirSync(workDir, { recursive:true });
  const resultFile = path.join(workDir, 'mods_with_ids.json');
  fs.writeFileSync(resultFile, JSON.stringify(queue, null, 2));

  res.json({
    ok:true,
    total:queue.length,
    found:queue.filter(x => x.status === 'found').length,
    multiple:queue.filter(x => x.status === 'multiple_matches').length,
    errors:queue.filter(x => x.status === 'error').length,
    file:resultFile
  });
};
