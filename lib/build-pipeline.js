const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { mergeDirectories, validateModFolder } = require('./mod-archive-builder');
const { prepareSource, cleanupPreparedSource, validateArchiveFile } = require('./archive-utils');
const { resolveGame } = require('./game-registry');

function validateWithAdapter(adapter, role, directory, genericValidation) {
  if (!adapter || typeof adapter.validateSource !== 'function') return { valid: true };
  const result = adapter.validateSource({ role, directory, files: genericValidation.files || [], generic: genericValidation });
  return result && typeof result === 'object' ? result : { valid: result !== false };
}

function outputFileName(adapter, name, artifactKey) {
  const requested = typeof adapter?.outputName === 'function' ? adapter.outputName({ name }) : `${name || 'mod'}_RU.zip`;
  const safe = path.basename(String(requested || 'mod_RU.zip')).replace(/[\r\n"]/g, '_');
  const withExtension = safe.toLowerCase().endsWith('.zip') ? safe : `${safe}.zip`;
  if (!artifactKey) return withExtension || 'mod_RU.zip';
  const identity = crypto.createHash('sha256').update(String(artifactKey)).digest('hex').slice(0, 12);
  return withExtension.slice(0, -4) + '-' + identity + '.zip';
}

async function buildReadyMod({ game = 'generic', name, artifactKey, originalPath, translationPath, outputDir }) {
  if (!originalPath && !translationPath) throw new Error('No source files for build');
  if (!outputDir) throw new Error('outputDir is required');

  const gameResolution = resolveGame(game);
  const adapter = gameResolution.adapter;
  let original = null;
  let translation = null;
  try {
    original = originalPath ? await prepareSource(originalPath, 'original') : null;
    translation = translationPath ? await prepareSource(translationPath, 'translation') : null;

    const originalGeneric = original ? validateModFolder(original.dir) : null;
    const translationGeneric = translation ? validateModFolder(translation.dir) : null;
    const validation = {
      game: { requested: gameResolution.requested, adapter: adapter.id, fallback: gameResolution.fallback },
      original: originalGeneric ? { ...originalGeneric, adapter: validateWithAdapter(adapter, 'original', original.dir, originalGeneric) } : null,
      translation: translationGeneric ? { ...translationGeneric, adapter: validateWithAdapter(adapter, 'translation', translation.dir, translationGeneric) } : null
    };

    if (validation.original && (!validation.original.valid || validation.original.adapter?.valid === false)) throw new Error(`Original mod source is invalid${validation.original.error ? `: ${validation.original.error}` : ''}`);
    if (validation.translation && (!validation.translation.valid || validation.translation.adapter?.valid === false)) throw new Error(`Translation source is invalid${validation.translation.error ? `: ${validation.translation.error}` : ''}`);

    fs.mkdirSync(outputDir, { recursive: true });
    let output = path.join(outputDir, outputFileName(adapter, name, artifactKey));
    if (fs.existsSync(output)) output = output.slice(0, -4) + '-' + crypto.randomUUID() + '.zip';
    const result = mergeDirectories(original?.dir, translation?.dir, output);
    const archive = await validateArchiveFile(output);
    if (!archive.readable || !archive.nonEmpty) throw new Error(`Built archive validation failed${archive.error ? `: ${archive.error}` : ''}`);

    return {
      ...result,
      game: gameResolution.requested,
      gameAdapter: adapter.id,
      gameAdapterFallback: gameResolution.fallback,
      validation,
      archive,
      exists: fs.existsSync(output)
    };
  } finally {
    cleanupPreparedSource(original);
    cleanupPreparedSource(translation);
  }
}

module.exports = { buildReadyMod, outputFileName };
