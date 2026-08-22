const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  if (req.query.action !== 'start') {
    return res.json({ ok:false, error:'use action=start' });
  }

  const source = path.join(process.cwd(), 'mods.txt');
  if (!fs.existsSync(source)) {
    return res.json({ ok:false, error:'mods.txt not found' });
  }

  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean);
  const queue = lines.map((name, i) => ({
    name: name.trim(),
    nexusModId: null,
    translationFileId: null,
    status: 'needs_search',
    index: i + 1
  }));

  fs.mkdirSync('RU_PACK_WORK', { recursive:true });
  fs.writeFileSync('RU_PACK_WORK/import-queue.json', JSON.stringify(queue, null, 2));

  res.json({ ok:true, total:queue.length, file:'RU_PACK_WORK/import-queue.json' });
};
