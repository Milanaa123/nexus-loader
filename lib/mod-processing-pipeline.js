const { ModContext } = require('./mod-context');
const { runPipeline, createStep } = require('./pipeline-runner');
const { createPipelineResult, setStatus, STATUSES } = require('./mod-status');

function normalizeGame(mod = {}) {
  const value = mod.game || mod.gameDomain || mod.game_domain || mod.nexusGame || null;
  return value ? String(value).trim().toLowerCase() : null;
}

function processingKey(mod = {}, providerId = 'nexus') {
  const game = normalizeGame(mod) || 'unknown';
  const modId = mod.nexusModId || mod.modId || null;
  if (modId) return `${providerId}:${game}:id:${modId}`.toLowerCase();
  return `${providerId}:${game}:name:${String(mod.name || mod.title || '').trim()}|${String(mod.author || '').trim()}`.toLowerCase();
}

function createModProcessingPipeline({ provider, translationFinder, builder, outputDir }) {
  if (!provider?.id || typeof provider.download !== 'function') throw new Error('A download-capable provider is required');
  if (typeof translationFinder !== 'function') throw new Error('translationFinder is required');
  if (typeof builder !== 'function') throw new Error('builder is required');
  if (!outputDir) throw new Error('outputDir is required');

  return async function processMod(mod = {}) {
    const game = normalizeGame(mod);
    let name = String(mod.name || mod.title || '').trim();
    let author = String(mod.author || '').trim();
    const nexusModId = mod.nexusModId || mod.modId || null;
    const key = processingKey(mod, provider.id);
    const context = new ModContext({
      id: key,
      game,
      provider: provider.id,
      source: mod.sourceUrl || null,
      metadata: { name, author, nexusModId },
      status: 'processing'
    });
    context.result = createPipelineResult({ key, name, author, game, provider: provider.id, nexusModId });

    if (!game) {
      context.result = setStatus(context.result, STATUSES.NEEDS_REVIEW, { error: 'game_required' });
      context.halt('game_required', STATUSES.NEEDS_REVIEW);
      return context;
    }
    if (!nexusModId) {
      context.result = setStatus(context.result, STATUSES.NEEDS_REVIEW, { error: 'mod_id_required' });
      context.halt('mod_id_required', STATUSES.NEEDS_REVIEW);
      return context;
    }

    const steps = [
      createStep('resolve_metadata', async current => {
        if (!name && provider.capabilities?.getMod && typeof provider.getMod === 'function') {
          const metadata = await provider.getMod({ game, modId: nexusModId });
          name = String(metadata?.name || '').trim();
          author = author || String(metadata?.author || '').trim();
          current.metadata = { ...current.metadata, name, author, nexusMetadata: metadata };
          current.result = { ...current.result, name, author };
        }
        if (!name) {
          current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { error: 'name_required' });
          current.halt('name_required', STATUSES.NEEDS_REVIEW);
        }
        return current;
      }),
      createStep('find_translation', async current => {
        const translation = await translationFinder({ game, modName: name, author, modId: nexusModId });
        if (!translation) {
          current.result = setStatus(current.result, STATUSES.TRANSLATION_MISSING);
          current.halt('translation_missing', STATUSES.TRANSLATION_MISSING);
          return current;
        }
        current.translation = translation;
        current.result = setStatus(current.result, STATUSES.TRANSLATION_FOUND, { translationId: translation.translationId });
        return current;
      }),
      createStep('download_original', async current => {
        const original = await provider.download({ game, modId: nexusModId });
        if (!original?.path) throw new Error('Original download returned no file');
        current.addFile({ role: 'original', ...original });
        current.original = original;
        current.result = setStatus(current.result, STATUSES.ORIGINAL_DOWNLOADED, { originalFile: original.path });
        return current;
      }),
      createStep('download_translation', async current => {
        const translated = await provider.download({ game, modId: current.translation.translationId });
        if (!translated?.path) throw new Error('Translation download returned no file');
        current.addFile({ role: 'translation', ...translated });
        current.translated = translated;
        current.result = setStatus(current.result, STATUSES.TRANSLATION_DOWNLOADED, { translationFile: translated.path });
        return current;
      }),
      createStep('build', async current => {
        const built = builder({
          name,
          originalPath: current.original.path,
          translationPath: current.translated.path,
          outputDir
        });
        if (!built?.output) throw new Error('Builder returned no output file');
        current.build = built;
        current.result = setStatus(current.result, STATUSES.BUILT, {
          outputFile: built.output,
          sha256: built.sha256 || null,
          validation: built.validation || null
        });
        current.status = STATUSES.BUILT;
        return current;
      })
    ];

    try {
      await runPipeline(context, steps);
    } catch (error) {
      context.result = setStatus(context.result, STATUSES.ERROR, { error: error.message || String(error) });
      context.fail(error);
    }
    return context;
  };
}

module.exports = { normalizeGame, processingKey, createModProcessingPipeline };
