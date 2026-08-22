const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  const input = path.join(__dirname, '..', 'mods_full_list.txt');
  const out = path.join(__dirname, '..', 'RU_PACK_WORK', 'mods_with_ids.json');

  if (!fs.existsSync(input)) {
    return res.status(404).json({ ok:false, error:'mods_full_list.txt not found' });
  }

  const lines = fs.readFileSync(input, 'utf8')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  const result = lines.map(name => ({
    name,
    modId: null,
    status: 'pending'
  }));

  fs.mkdirSync(path.dirname(out), { recursive:true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');

  return res.json({
    ok:true,
    total: result.length,
    found: 0,
    file:'RU_PACK_WORK/mods_with_ids.json',
    status:'generator_ready'
  });
};
