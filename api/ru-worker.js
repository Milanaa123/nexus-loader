const fs = require('fs');
const path = require('path');
const https = require('https');

function getJson(url, headers = {}) {
  return new Promise(resolve => {
    https.get(url, { headers }, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    }).on('error', () => resolve({}));
  });
}

function parseList(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i].trim();
    const author = (lines[i + 1] || '').trim();
    if (name && author && !name.startsWith('(') && !author.startsWith('(')) {
      out.push({ name, author });
      i++;
    }
  }
  return out;
}

function norm(s) {
  return String(s || '').toLowerCase();
}

async function findRU(mod) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) return { status: 'missing_api_key' };

  const q = encodeURIComponent(`${mod.name} ${mod.author}`);
  const data = await getJson(`https://api.nexusmods.com/v1/games/stardewvalley/search.json?terms=${q}`, { apikey: key });
  const list = Array.isArray(data) ? data : (data.results || []);

  const ru = list.find(x => {
    const text = norm((x.name || '') + ' ' + (x.summary || ''));
    return text.includes('russian') || text.includes('translation') || text.includes('ru') || text.includes('рус');
  });

  return ru
    ? { status: 'translation_found', modId: ru.mod_id, name: ru.name }
    : { status: 'no_translation_found' };
}

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const mods = parseList(path.join(root, 'моды(3).txt'));
  const result = [];

  for (const mod of mods) {
    try {
      result.push({ ...mod, ...(await findRU(mod)) });
    } catch (e) {
      result.push({ ...mod, status: 'error_continue' });
    }
  }

  fs.writeFileSync(path.join(root, 'ru-status.json'), JSON.stringify(result, null, 2));
  res.json({ ok: true, total: mods.length, processed: result.length });
};
