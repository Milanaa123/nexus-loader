const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const { mergeDirectories, validateModFolder } = require('./mod-archive-builder');

function makeTempDir(name = 'nexus-loader-build') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function cleanupTempDir(dir) {
  if (!dir) return;
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (_) {
    // Temporary cleanup failure must not hide build result.
  }
}

function extractIfZip(source, label) {
  if (!source || !fs.existsSync(source)) return null;
  if (!source.toLowerCase().endsWith('.zip')) return source;

  const dir = makeTempDir(label);
  const zip = new AdmZip(source);
  zip.extractAllTo(dir, true);
  return dir;
}

function validateArchive(file) {
  if (!file || !fs.existsSync(file)) {
    return { exists: false, readable: false };
  }
  try {
    const zip = new AdmZip(file);
    return { exists: true, readable: zip.getEntries().length >= 0 };
  } catch (e) {
    return { exists: true, readable: false, error: e.message };
  }
}

function buildReadyMod({ name, originalPath, translationPath, outputDir }) {
  if (!originalPath && !translationPath) {
    throw new Error('No source files for build');
  }

  let originalDir = null;
  let translationDir = null;

  try {
    originalDir = extractIfZip(originalPath, 'original');
    translationDir = extractIfZip(translationPath, 'translation');

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
      archive: validateArchive(output),
      exists: fs.existsSync(output)
    };
  } finally {
    cleanupTempDir(originalDir);
    cleanupTempDir(translationDir);
  }
}

module.exports = { buildReadyMod };
