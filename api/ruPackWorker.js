const worker = require('../scripts/ru-pack-worker');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = async function(req, res) {
  const action = (req.body && req.body.action) || (req.query && req.query.action) || 'status';

  try {
    if (action === 'status') {
      const progress = worker.loadProgress();
      if (!progress.total) {
        const queueFile = path.join(__dirname, '..', 'data', 'queue', 'ru-pack-queue.json');
        try {
          const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
          const items = queue.items || queue.mods || [];
          if (items.length) return res.json({ ok:true, data:{...progress,total:items.length,remaining:items.length} });
        } catch {}
      }
      return res.json({ ok:true, data:progress });
    }

    if (action === 'start') {
      const current = worker.loadProgress();
      if (current.running) return res.json({ ok:true, status:'already_running', data:current });

      const child = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'ru-pack-daemon.js')], {
        detached:true,
        stdio:'ignore'
      });
      child.unref();

      return res.json({ ok:true, status:'worker_started', data:worker.loadProgress() });
    }

    return res.status(400).json({ok:false,error:'Unknown action'});
  } catch(e) {
    return res.status(500).json({ok:false,error:e.message});
  }
};
