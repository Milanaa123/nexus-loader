const fs = require('fs');
const path = require('path');
const { mergeDirectories, validateModFolder } = require('./mod-archive-builder');
const { prepareSource, cleanupPreparedSource, validateArchiveFile } = require('./archive-utils');

async function buildReadyMod({ name, originalPath, translationPath, outputDir }) {
  if (!originalPath && !translationPath) throw new Error('No source files for build');
  if (!outputDir) throw new Error('outputDir is required');

  let original = null;
  let translation = null;
  try {
    original = originalPath ? await prepareSource(originalPath, 'original') : null;
    translation = translationPath ? await prepareSource(translationPath, 'translation') : null;

    const validation = {
      original: original ? validateModFolder(original.dir) : null,
      translation: translation ? validateModFolder(translation.dir) : null
    };
    if (validation.original && !validation.original.valid) throw new Error('Original mod source is invalid');
    if (validation.translation && !validation.translation.valid) throw new Error('Translation source is invalid');

    fs.mkdirSync(outputDir, { recursive: true });
    const safeName = String(name || 'mod').replace(/[^a-z0-9а-яё_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'mod';
    const output = path.join(outputDir, `${safeName}_RU.zip`);
    const result = mergeDirectories(original?.dir, translation?.dir, output);
    const archive = await validateArchiveFile(output);
    if (!archive.readable || !archive.nonEmpty) throw new Error(`Built archive validation failed${archive.error ? `: ${archive.error}` : ''}`);

    return { ...result, validation, archive, exists: fs.existsSync(output) };
  } finally {
    cleanupPreparedSource(original);
    cleanupPreparedSource(translation);
  }
}

module.exports = { buildReadyMod };
