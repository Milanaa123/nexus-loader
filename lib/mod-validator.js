const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function validateZip(file) {
  const result = {
    exists: false,
    readable: false,
    entries: 0,
    files: 0,
    hasManifest: false,
    hasContentPatcher: false,
    valid: false,
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
      if (entry.isDirectory) continue;

      result.files += 1;
      const name = entry.entryName.replace(/\\/g, '/').toLowerCase();

      if (path.basename(name) === 'manifest.json') {
        result.hasManifest = true;
      }

      if (name.includes('content.json')) {
        result.hasContentPatcher = true;
      }
    }

    if (result.entries === 0 || result.files === 0) {
      result.errors.push('archive_empty');
    }

    if (!result.hasManifest) {
      result.errors.push('manifest_missing');
    }

    result.valid = result.readable && result.files > 0 && result.hasManifest;
  } catch (error) {
    result.errors.push('archive_unreadable');
    result.error = error.message;
  }

  return result;
}

module.exports = { validateZip };
