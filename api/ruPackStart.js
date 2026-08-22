const fs = require('fs');
const path = require('path');

module.exports = async function (req, res) {
  const root = path.join(__dirname, '..');
  const progressFile = path.join(root, 'RU_PACK_WORK', 'progress.json');

  const progress = {
    total: 535,
    ready: 1,
    remaining: 534,
    updated: 0,
    fixed: 0,
    createdTranslations: 0,
    noTranslation: 0,
    status: 'queue_ready'
  };

  fs.mkdirSync(path.dirname(progressFile), { recursive: true });
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf8');

  return res.json({
    ok: true,
    message: 'RU pack queue initialized',
    progress
  });
};
