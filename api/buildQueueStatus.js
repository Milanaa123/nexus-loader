const fs = require('fs');

module.exports = async function buildQueueStatus(req, res) {
  const file = 'RU_PACK_WORK/build_queue.json';

  if (!fs.existsSync(file)) {
    return res.json({
      ok: true,
      total: 0,
      queue: []
    });
  }

  const queue = JSON.parse(fs.readFileSync(file, 'utf8'));

  res.json({
    ok: true,
    total: queue.length,
    queue
  });
};
