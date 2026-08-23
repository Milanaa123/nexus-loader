const fs = require('fs');
const path = require('path');

module.exports = async function(req, res) {
  const root = path.join(__dirname, '..');
  const queueFile = path.join(root, 'queue.json');
  let queue = [];

  if (fs.existsSync(queueFile)) {
    try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')); } catch (_) {}
  }

  const started = queue.filter(x => !x.done).length;
  fs.writeFileSync(path.join(root, 'worker-state.json'), JSON.stringify({
    running: true,
    startedAt: new Date().toISOString(),
    remaining: started
  }, null, 2));

  return res.json({
    ok: true,
    started: true,
    queueSize: started,
    message: 'Translation scan started'
  });
};
