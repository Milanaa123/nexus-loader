const { ModContext } = require('./mod-context');
const { runPipeline, createStep } = require('./pipeline-runner');
const { createPipelineResult, setStatus, STATUSES } = require('./mod-status');
const { selectMatch, publicCandidate } = require('./mod-matcher');

function normalizeGame(mod = {}) {
  const value = mod.game || mod.gameDomain || mod.game_domain || mod.nexusGame || null;
  return value ? String(value).trim().toLowerCase() : null;
}

function processingKey(mod = {}, providerId = 'nexus') {
  if (mod.key) return String(mod.key);
  const game = normalizeGame(mod) || 'unknown';
  const modId = mod.nexusModId || mod.modId || null;
  if (modId) return `${providerId}:${game}:id:${modId}`.toLowerCase();
  return `${providerId}:${game}:name:${String(mod.name || mod.title || '').trim()}|${String(mod.author || '').trim()}`.toLowerCase();
}

function createModProcessingPipeline({ provider, translationFinder, builder, outputDir, onCheckpoint = async () => {} }) {
  if (!provider?.id || typeof provider.download !== 'function') throw new Error('A download-capable provider is required');
  if (typeof translationFinder !== 'function') throw new Error('translationFinder is required');
  if (typeof builder !== 'function') throw new Error('builder is required');
  if (!outputDir) throw new Error('outputDir is required');

  return async function processMod(mod = {}, resume = {}) {
    const game = normalizeGame(mod);
    let name = String(mod.name || mod.title || resume.name || '').trim();
    let author = String(mod.author || resume.author || '').trim();
    let nexusModId = mod.nexusModId || mod.modId || resume.nexusModId || null;
    const key = processingKey(mod, provider.id);
    const context = new ModContext({ id: key, game, provider: provider.id, source: mod.sourceUrl || null, metadata: { name, author, nexusModId }, status: 'processing' });
    context.result = { ...resume, ...createPipelineResult({ ...resume, key, name, author, game, provider: provider.id, nexusModId, status: STATUSES.IMPORTED, error: null }) };

    async function reuseDownload(role, file, metadata) {
      if (!file || typeof provider.validate !== 'function') return null;
      if (!await provider.validate({ ...metadata, path: file })) return null;
      return { ...metadata, role, path: file, cached: true };
    }

    if (!game) {
      context.result = setStatus(context.result, STATUSES.NEEDS_REVIEW, { error: 'game_required' });
      context.halt('game_required', STATUSES.NEEDS_REVIEW);
      return context;
    }
    if (!nexusModId && !name) {
      context.result = setStatus(context.result, STATUSES.NEEDS_REVIEW, { error: 'mod_identity_required' });
      context.halt('mod_identity_required', STATUSES.NEEDS_REVIEW);
      return context;
    }

    const steps = [
      createStep('resolve_mod', async current => {
        if (nexusModId) {
          if (!name && provider.capabilities?.getMod && typeof provider.getMod === 'function') {
            const metadata = await provider.getMod({ game, modId: nexusModId });
            name = String(metadata?.name || '').trim();
            author = author || String(metadata?.author || '').trim();
            current.metadata = { ...current.metadata, name, author, nexusModId, nexusMetadata: metadata };
          }
          if (!name) {
            current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { nexusModId, error: 'name_required' });
            current.halt('name_required', STATUSES.NEEDS_REVIEW);
            return current;
          }
          current.result = setStatus({ ...current.result, name, author }, STATUSES.FOUND, { nexusModId });
          return current;
        }

        if (!provider.capabilities?.search || typeof provider.search !== 'function') throw new Error(`Provider ${provider.id} cannot search mods`);
        const candidates = await provider.search({ game, name, author, limit: 40 });
        const selected = selectMatch({ name, author }, candidates);
        if (selected.status === 'not_found') {
          current.result = setStatus(current.result, STATUSES.NOT_FOUND);
          current.halt('not_found', STATUSES.NOT_FOUND);
          return current;
        }
        if (selected.status === 'multiple_matches') {
          current.result = setStatus(current.result, STATUSES.MULTIPLE_MATCHES, { candidates: selected.candidates });
          current.halt('multiple_matches', STATUSES.MULTIPLE_MATCHES);
          return current;
        }

        const candidate = selected.candidate;
        nexusModId = candidate.modId || candidate.mod_id;
        name = String(candidate.name || name).trim();
        author = String(candidate.author || author).trim();
        current.metadata = { ...current.metadata, name, author, nexusModId, resolvedCandidate: publicCandidate(candidate) };
        current.result = setStatus({ ...current.result, name, author }, STATUSES.FOUND, { nexusModId });
        return current;
      }),
      createStep('find_translation', async current => {
        const translation = current.result.translationId
          ? { translationId: current.result.translationId }
          : await translationFinder({ game, modName: name, author, modId: nexusModId });
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
        const original = await reuseDownload('original', current.result.originalFile, current.result.originalDownload)
          || await provider.download({ game, modId: nexusModId, role: 'original' });
        if (!original?.path) throw new Error('Original download returned no file');
        current.addFile({ role: 'original', ...original });
        current.original = original;
        current.result = setStatus(current.result, STATUSES.ORIGINAL_DOWNLOADED, { originalFile: original.path, originalDownload: original });
        return current;
      }),
      createStep('download_translation', async current => {
        const translated = await reuseDownload('translation', current.result.translationFile, current.result.translationDownload)
          || await provider.download({ game, modId: current.translation.translationId, role: 'translation' });
        if (!translated?.path) throw new Error('Translation download returned no file');
        current.addFile({ role: 'translation', ...translated });
        current.translated = translated;
        current.result = setStatus(current.result, STATUSES.TRANSLATION_DOWNLOADED, { translationFile: translated.path, translationDownload: translated });
        return current;
      }),
      createStep('build', async current => {
        const built = await builder({ game, name, artifactKey: key, originalPath: current.original.path, translationPath: current.translated.path, outputDir });
        if (!built?.output) throw new Error('Builder returned no output file');
        current.build = built;
        current.result = setStatus(current.result, STATUSES.BUILT, { outputFile: built.output, sha256: built.sha256 || null, validation: built.validation || null });
        current.status = STATUSES.BUILT;
        return current;
      })
    ];

    try {
      await runPipeline(context, steps.map(step => async current => {
        const next = await step(current);
        try { await onCheckpoint(next.result, next); }
        catch (error) { error.checkpointFailure = true; throw error; }
        return next;
      }));
    }
    catch (error) {
      if (error.checkpointFailure) throw error;
      context.result = setStatus(context.result, STATUSES.ERROR, { error: error.message || String(error) });
      context.fail(error);
    }
    return context;
  };
}

module.exports = { normalizeGame, processingKey, createModProcessingPipeline };
