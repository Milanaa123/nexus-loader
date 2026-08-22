const fs = require('fs');
const path = require('path');

const GAME = 'stardewvalley';

async function nexus(url) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');
  const r = await fetch(url, {
    headers: { apikey: key, 'x-api-key': key }
  });
  if (!r.ok) throw new Error(`Nexus ${r.status}`);
  return r.json();
}

function parseLine(line) {
  return line.replace(/^\s*\(.*?\)\s*/, '').trim();
}

module.exports = async function(req, res) {
  if (req.query.action !== 'start') {
    return res.json({ ok:false, error:'use action=start' });
  }

  const source = path.join(process.cwd(), 'mods.txt');
  if (!fs.existsSync(source)) {
    return res.json({ ok:false, error:'mods.txt not found' });
  }

  const lines = fs.readFileSync(source, 'utf8')
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean);

  const queue = [];

  for (const name of lines) {
    let item = {
      name,
      nexusModId: null,
      translationFileId: null,
      status: 'not_found'
    };

    try {
      const found = await nexus(`https://api.nexusmods.com/v1/games/${GAME}/mods.json?search=${encodeURIComponent(name)}`);
      const mod = Array.isArray(found) ? found[0] : null;
      if (mod) {
        item.nexusModId = mod.mod_id;
        item.status = 'found';
      }
    } catch (e) {
      item.status = 'search_error';
      item.error = e.message;
    }

    queue.push(item);
  }

  fs.mkdirSync('RU_PACK_WORK', { recursive:true });
  fs.writeFileSync('RU_PACK_WORK/import-queue.json', JSON.stringify(queue, null, 2));

  res.json({
    ok:true,
    total:queue.length,
    found:queue.filter(x=>x.nexusModId).length,
    file:'RU_PACK_WORK/import-queue.json'
  });
};
