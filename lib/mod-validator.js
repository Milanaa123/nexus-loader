const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function validateZip(file) {
  const result = {
    exists: false,
    readable: false,
    entries: 0,
    hasManifest: false,
    hasContentPatcher: false,
    errors: []
  };

  if (!file || !fs.existsSync(file)) {
    result.errors.push('archive_missing');
    return result;
  }

  result.exists = true;

  try {
    const zip = new AdmZip(file);
    const entries = zip.getEntries();

    result.readable = true;
    result.entries = entries.length;

    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();
      if (path.basename(name) === 'manifest.json') {
        result.hasManifest = true;
      }
      if (name.includes('content.json')) {
        result.hasContentPatcher = true;
      }
    }

    if (!result.hasManifest) {
      result.errors.push('manifest_missing');
    }
  } catch (error) {
    result.errors.push('archive_unreadable');
    result.error = error.message;
  }

  return result;
}

module.exports = { validateZip };
