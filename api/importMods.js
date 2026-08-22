const fs = require('fs');
const path = require('path');

const GAME = 'stardewvalley';

async function nexus(url) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');
  const r = await fetch(url, { headers: { apikey: key, 'x-api-key': key } });
  if (!r.ok) throw new Error(`Nexus ${r.status}`);
  return r.json();
}

function parseMods(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\(.*?\)\s*/, '').trim();
    const next = lines[i + 1] ? lines[i + 1].trim() : '';
    const third = lines[i + 2] ? lines[i + 2].trim() : '';
    if (line && next && third && !next.includes(' ') && !['Crops','Furniture','Items','Buildings','Dialogue','Maps','Audio','Characters','Expansions','Portraits','Visuals and Graphics','User Interface','Miscellaneous','Gameplay Mechanics','Crafting','Modding Tools','New Characters'].includes(third)) {
      result.push({ name: line, author: next });
      i += 2;
    }
  }
  return result;
}

module.exports = async function(req, res) {
  if (req.query.action !== 'start') return res.json({ok:false,error:'use action=start'});

  const source = path.join(process.cwd(), 'mods.txt');
  if (!fs.existsSync(source)) return res.json({ok:false,error:'mods.txt not found'});

  const mods = parseMods(fs.readFileSync(source, 'utf8'));
  const queue = [];

  for (const modData of mods) {
    const item = {...modData, nexusModId:null, translationFileId:null, status:'not_found'};
    try {
      const found = await nexus(`https://api.nexusmods.com/v1/games/${GAME}/mods.json?search=${encodeURIComponent(modData.name)}`);
      const mod = Array.isArray(found) ? found.find(x => !modData.author || String(x.author).toLowerCase().includes(modData.author.toLowerCase())) || found[0] : null;
      if (mod) {
        item.nexusModId = mod.mod_id;
        item.status = 'found';
      }
    } catch(e) {
      item.status = 'search_error';
      item.error = e.message;
    }
    queue.push(item);
  }

  fs.mkdirSync('RU_PACK_WORK',{recursive:true});
  fs.writeFileSync('RU_PACK_WORK/mods_with_ids.json', JSON.stringify(queue,null,2));
  res.json({ok:true,total:queue.length,found:queue.filter(x=>x.nexusModId).length,file:'RU_PACK_WORK/mods_with_ids.json'});
};
