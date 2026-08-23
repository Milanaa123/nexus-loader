const worker = require('../scripts/ru-pack-worker');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function queueTotal() {
  try {
    const file = path.join(__dirname, '..', 'data', 'queue', 'ru-pack-queue.json');
    const q = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (q.items || q.mods || []).length;
  } catch { return 0; }
}

function normalize(progress) {
  const total = progress.total || queueTotal();
  return {
    ...progress,
    total,
    remaining: progress.running ? Math.max(total - (progress.processed || 0), 0) : (progress.remaining || 0)
  };
}

module.exports = async function(req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

  try {
    if (action === 'status') {
      return res.json({ ok:true, data:normalize(worker.loadProgress()) });
    }

    if (action === 'start') {
      const current = normalize(worker.loadProgress());
      if (current.running) return res.json({ ok:true, status:'already_running', data:current });

      const child = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'ru-pack-daemon.js')], {
        detached:true,
        stdio:'ignore'
      });
      child.unref();

      return res.json({ ok:true, message:'RU pack worker started', progress:normalize(worker.loadProgress()) });
    }

    return res.status(400).json({ok:false,error:'Unknown action'});
  } catch(e) {
    return res.status(500).json({ok:false,error:e.message});
  }
};
