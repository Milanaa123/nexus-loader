const path = require('path');
const fs = require('fs');
const { mergeDirectories, validateModFolder } = require('./mod-archive-builder');

function buildReadyMod({ name, originalPath, translationPath, outputDir }) {
  if (!originalPath && !translationPath) {
    throw new Error('No source files for build');
  }

  const validation = {
    original: originalPath ? validateModFolder(originalPath) : null,
    translation: translationPath ? validateModFolder(translationPath) : null
  };

  const safeName = String(name || 'mod').replace(/[^a-z0-9а-яё_-]+/gi, '_');
  const output = path.join(outputDir, `${safeName}_RU.zip`);
  const result = mergeDirectories(originalPath, translationPath, output);

  return {
    ...result,
    validation,
    exists: fs.existsSync(output)
  };
}

module.exports = { buildReadyMod };
