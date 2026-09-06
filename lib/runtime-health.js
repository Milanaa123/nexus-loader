const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

const HEALTH_FILE = path.join(paths.workDir, 'health.json');

function write(data) {
  fs.mkdirSync(path.dirname(HEALTH_FILE), { recursive: true });
  const tmp = `${HEALTH_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, HEALTH_FILE);
}

function mark(status, details = {}) {
  write({
    status,
    pid: process.pid,
    updatedAt: new Date().toISOString(),
    ...details
  });
}

module.exports = { mark };
