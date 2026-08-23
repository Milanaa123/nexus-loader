const fs = require('fs');
const path = require('path');
const https = require('https');

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
      });
    }).on('error', reject);
  });
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
}

async function searchMod(name, author, apiKey) {
  const q = encodeURIComponent(`${name} ${author || ''}`.trim());
  const data = await getJson(
    `https://api.nexusmods.com/v1/games/stardewvalley/search.json?terms=${q}`,
    { apikey: apiKey }
  );
  return Array.isArray(data) ? data : [];
}

async function findTranslation(mod) {
  const apiKey = process.env.NEXUS_API_KEY;
  if (!apiKey) return { status: 'missing_api_key' };

  const found = await searchMod(mod.name, mod.author, apiKey);
  const target = found.find(x => {
    const title = normalize(x.name);
    return title.includes('russian') || title.includes('ru') || title.includes('рус');
  });

  if (!target) {
    return {
      status: 'no_translation_found',
      checked: true
    };
  }

  return {
    status: 'translation_found',
    nexusModId: target.mod_id,
    translationName: target.name
  };
}

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'queue.json');
  let queue = [];

  if (fs.existsSync(queueFile)) {
    try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch (_) {}
  }

  const batch = queue.filter(x => !x.done).slice(0, 20);
  const result = [];

  for (const mod of batch) {
    try {
      const check = await findTranslation(mod);
      mod.status = check.status;
      mod.translation = check;
      result.push({ name: mod.name, status: check.status });
    } catch (e) {
      mod.status = 'error_continue';
      mod.error = e.message;
      result.push({ name: mod.name, status: 'error_continue' });
    }
  }

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

  return res.json({
    ok: true,
    processed: result.length,
    batch: result,
    message: 'Worker continues after missing translations'
  });
};
