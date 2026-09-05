const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function validateZip(file) {
  const result = { exists: false, readable: false, entries: 0, hasManifest: false };
  if (!file || !fs.existsSync(file)) return result;

  result.exists = true;
  try {
    const zip = new AdmZip(file);
    const entries = zip.getEntries();
    result.readable = true;
    result.entries = entries.length;
    result.hasManifest = entries.some(e => path.basename(e.entryName).toLowerCase() === 'manifest.json');
  } catch (_) {
    result.readable = false;
  }

  return result;
}

module.exports = { validateZip };
