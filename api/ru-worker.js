const fs = require('fs');
const path = require('path');
const https = require('https');

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    }).on('error', reject);
  });
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
    let status = 'waiting';
    if (mod.modId && process.env.NEXUS_API_KEY) {
      const data = await getJson(
        `https://api.nexusmods.com/v1/games/stardewvalley/mods/${mod.modId}.json`,
        { apikey: process.env.NEXUS_API_KEY }
      );
      status = data.name ? 'found_on_nexus' : 'not_found';
    } else {
      status = 'missing_mod_id_or_api_key';
    }
    mod.status = status;
    result.push({ name: mod.name, status });
  }

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));

  return res.json({
    ok: true,
    processed: result.length,
    batch: result
  });
};
