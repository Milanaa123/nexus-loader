const fs = require('fs');
const paths = require('../config/paths');

module.exports = async function buildQueueStatus(req, res) {
  const file = paths.queueFile;

  if (!fs.existsSync(file)) {
    return res.json({
      ok: true,
      total: 0,
      queue: []
    });
  }

  try {
    const queue = JSON.parse(fs.readFileSync(file, 'utf8'));

    res.json({
      ok: true,
      total: queue.length,
      queue
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'queue_read_failed',
      message: error.message
    });
  }
};
