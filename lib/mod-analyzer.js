const path = require('path');
const fs = require('fs');

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

function analyze(directory) {
  const files = walk(directory);

  return {
    files,
    hasManifest: files.some(file => path.basename(file).toLowerCase() === 'manifest.json'),
    localizationFiles: files.filter(file => /(?:i18n|locale|translation|localization|content|strings)/i.test(file))
  };
}

module.exports = { analyze };
