const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  const stateFile = path.join(__dirname, '..', 'RU_PACK_WORK', 'generator_status.json');

  if (!fs.existsSync(stateFile)) {
    return res.json({
      ok: true,
      running: false,
      status: 'no_status_file'
    });
  }

  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return res.json({
      ok: true,
      ...data,
      remaining: Math.max(0, (data.total || 0) - (data.processed || 0))
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
