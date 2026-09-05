const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const { mergeDirectories, validateModFolder } = require('./mod-archive-builder');

function makeTempDir(name = 'nexus-loader-build') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  return dir;
}

function extractIfZip(source, label) {
  if (!source || !fs.existsSync(source)) return null;
  if (!source.toLowerCase().endsWith('.zip')) return source;

  const dir = makeTempDir(label);
  const zip = new AdmZip(source);
  zip.extractAllTo(dir, true);
  return dir;
}

function buildReadyMod({ name, originalPath, translationPath, outputDir }) {
  if (!originalPath && !translationPath) {
    throw new Error('No source files for build');
  }

  const originalDir = extractIfZip(originalPath, 'original');
  const translationDir = extractIfZip(translationPath, 'translation');

  const validation = {
    original: originalDir ? validateModFolder(originalDir) : null,
    translation: translationDir ? validateModFolder(translationDir) : null
  };

  if (validation.original && !validation.original.exists) {
    throw new Error('Original mod source missing');
  }

  const safeName = String(name || 'mod').replace(/[^a-z0-9а-яё_-]+/gi, '_');
  const output = path.join(outputDir, `${safeName}_RU.zip`);
  const result = mergeDirectories(originalDir, translationDir, output);

  return {
    ...result,
    validation,
    exists: fs.existsSync(output)
  };
}

module.exports = { buildReadyMod };
