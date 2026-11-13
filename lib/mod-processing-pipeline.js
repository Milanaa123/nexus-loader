const { ModContext } = require('./mod-context');
const { runPipeline, createStep } = require('./pipeline-runner');
const { createPipelineResult, setStatus, STATUSES } = require('./mod-status');
const { selectMatch, publicCandidate, verifyModIdentity } = require('./mod-matcher');

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
    context.result = { ...resume, ...createPipelineResult({ ...resume, key, name, author, game, provider: provider.id, nexusModId, status: STATUSES.IMPORTED, error: null }), errorCode: null, action: null, retryAfterMs: null };

    async function reuseDownload(role, file, metadata, expectedModId, expectedFileId) {
      if (!file || typeof provider.validate !== 'function') return null;
      if ((metadata?.game && metadata.game !== game) || (metadata?.modId && String(metadata.modId) !== String(expectedModId)) || (expectedFileId && String(metadata?.fileId) !== String(expectedFileId))) return null;
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
          if (provider.capabilities?.getMod && typeof provider.getMod === 'function') {
            const metadata = await provider.getMod({ game, modId: nexusModId });
            const verified = verifyModIdentity({ name, author, game, nexusModId }, metadata);
            if (verified.status !== STATUSES.FOUND) {
              current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { error: verified.reason, candidates: verified.candidates, conflicts: verified.conflicts || [] });
              current.halt(verified.reason, STATUSES.NEEDS_REVIEW);
              return current;
            }
            name = verified.candidate.name;
            author = verified.candidate.author;
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
        const selected = selectMatch({ game, name, author }, candidates);
        if (selected.status === 'not_found') {
          current.result = setStatus(current.result, STATUSES.NOT_FOUND, { reason: selected.reason || null, candidates: selected.candidates || [] });
          current.halt('not_found', STATUSES.NOT_FOUND);
          return current;
        }
        if (selected.status === 'multiple_matches') {
          current.result = setStatus(current.result, STATUSES.MULTIPLE_MATCHES, { candidates: selected.candidates, reason: selected.reason || null });
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
        const selection = current.result.translationSelection;
        const bound = selection?.schema === 1 && selection.game === game && String(selection.originalModId) === String(nexusModId) && String(selection.translationId) === String(current.result.translationId);
        if (!bound && current.result.translationId) {
          // Legacy/unbound decisions are rechecked. Old files and descriptors are retained, not reused for a new decision.
          const assets = current.result.remoteAssets || {};
          const { translationFile, outputFile, ...remaining } = assets;
          current.result.retainedTranslations = [...(current.result.retainedTranslations || []), { translationId: current.result.translationId, translationFile: current.result.translationFile, translationDownload: current.result.translationDownload, outputFile: current.result.outputFile, remoteAssets: { translationFile, outputFile } }];
          Object.assign(current.result, { translationId: null, translationFile: null, translationDownload: null, outputFile: null, sha256: null, remoteAssets: remaining, translationMatch: null, translationSelection: null });
        }
        const translation = bound ? current.result.translationMatch || { translationId: current.result.translationId }
          : await translationFinder({ game, modName: name, author, modId: nexusModId });
        if (!translation) {
          current.result = setStatus(current.result, STATUSES.TRANSLATION_MISSING);
          current.halt('translation_missing', STATUSES.TRANSLATION_MISSING);
          return current;
        }
        if (translation.status === STATUSES.NEEDS_REVIEW) {
          current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { error: translation.reason, translationCandidates: translation.candidates || [], translationSearch: translation.search || null });
          current.halt(translation.reason, STATUSES.NEEDS_REVIEW);
          return current;
        }
        if (!/^[1-9]\d*$/.test(String(translation.translationId || '')) || String(translation.translationId) === String(nexusModId) || (translation.game && translation.game !== game) || (translation.originalModId && String(translation.originalModId) !== String(nexusModId))) {
          current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { error: 'invalid_translation_identity' });
          current.halt('invalid_translation_identity', STATUSES.NEEDS_REVIEW);
          return current;
        }
        current.translation = translation;
        current.result = setStatus(current.result, STATUSES.TRANSLATION_FOUND, { translationId: translation.translationId, translationMatch: translation, translationSelection: { schema: 1, game, originalModId: String(nexusModId), translationId: String(translation.translationId) } });
        return current;
      }),
      createStep('download_original', async current => {
        const original = await reuseDownload('original', current.result.originalFile, current.result.originalDownload, nexusModId, mod.originalFileId)
          || await provider.download({ game, modId: nexusModId, fileId: mod.originalFileId || undefined, role: 'original' });
        if (!original?.path) throw new Error('Original download returned no file');
        current.addFile({ role: 'original', ...original });
        current.original = original;
        current.result = setStatus(current.result, STATUSES.ORIGINAL_DOWNLOADED, { originalFile: original.path, originalDownload: original });
        return current;
      }),
      createStep('download_translation', async current => {
        const translated = await reuseDownload('translation', current.result.translationFile, current.result.translationDownload, current.translation.translationId, mod.translationFileId)
          || await provider.download({ game, modId: current.translation.translationId, fileId: mod.translationFileId || undefined, role: 'translation' });
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
        if (built.validation?.needsReview) {
          current.result = setStatus(current.result, STATUSES.NEEDS_REVIEW, { outputFile: built.output, sha256: built.sha256 || null, validation: built.validation, error: 'incomplete_russian_i18n_coverage' });
          current.halt('incomplete_russian_i18n_coverage', STATUSES.NEEDS_REVIEW);
          return current;
        }
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
      if (error.code === 'NEEDS_REVIEW' || (error.code?.startsWith('NEXUS_') && error.retryable === false)) {
        const notFound = error.code === 'NEXUS_NOT_FOUND' && context.steps.at(-1)?.name === 'resolve_mod';
        const status = notFound ? STATUSES.NOT_FOUND : STATUSES.NEEDS_REVIEW;
        context.result = setStatus(context.result, status, { error: error.message, errorCode: error.code, action: error.action || null });
        context.halt(error.message, status);
        return context;
      }
      context.result = setStatus(context.result, STATUSES.ERROR, { error: error.message || String(error), errorCode: error.code || null, retryAfterMs: error.retryAfterMs || null, translationCandidates: error.candidates || [], translationSearch: error.search || null });
      context.fail(error);
    }
    return context;
  };
}

module.exports = { normalizeGame, processingKey, createModProcessingPipeline };
