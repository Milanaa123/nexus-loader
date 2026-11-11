const paths = require('../config/paths');
const { writeJson } = require('./file-store');

function mark(status, details = {}) {
  writeJson(paths.healthFile, { status, pid: process.pid, updatedAt: new Date().toISOString(), ...details });
}
module.exports = { mark };
