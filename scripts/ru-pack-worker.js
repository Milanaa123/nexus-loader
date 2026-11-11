const fs = require('fs');
const { digestFile } = require('../lib/file-integrity');
const paths = require('../config/paths');
const { findTranslation } = require('./find-translation');
const { buildReadyMod } = require('../lib/build-pipeline');
const { validateArchiveFile } = require('../lib/archive-utils');
const { STATUSES } = require('../lib/mod-status');
const state = require('../lib/state-store');
const jobQueue = require('../lib/job-queue');
const { getProvider } = require('../providers/provider-registry');
const { createModProcessingPipeline, processingKey } = require('../lib/mod-processing-pipeline');
const { acquireWorkerLock } = require('../lib/worker-lock');
require('../providers/nexus-provider');

const TERMINAL_STATUSES = new Set([
  STATUSES.BUILT, STATUSES.NOT_FOUND, STATUSES.MULTIPLE_MATCHES,
  STATUSES.TRANSLATION_MISSING, STATUSES.NEEDS_REVIEW, STATUSES.RETRY_EXHAUSTED
]);
function isTerminalStatus(status) { return TERMINAL_STATUSES.has(status); }
function upsertByKey(list, value) {
  const index = list.findIndex(item => item?.key === value.key);
  if (index < 0) list.push(value);
  else list[index] = value;
}
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
async function validBuiltResult(result) {
  if (!result?.outputFile || !result.sha256) return false;
  try {
    const hash = await digestFile(result.outputFile);
    if (hash !== result.sha256) return false;
    const validation = await validateArchiveFile(result.outputFile);
    return validation.readable && validation.nonEmpty;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return false;
    throw error;
  }
}

function createWorker(options = {}) {
  const maxAttempts = positive(options.maxAttempts || process.env.NEXUS_LOADER_MAX_ATTEMPTS, 3);
  const retryBaseMs = positive(options.retryBaseMs || process.env.NEXUS_LOADER_RETRY_BASE_MS, 30_000);
  const now = options.now || Date.now;

  async function processQueue(items = jobQueue.load()) {
    if (!Array.isArray(items)) throw new Error('Worker queue must be an array');
    const lease = acquireWorkerLock();
    let heartbeatError = null;
    const heartbeat = setInterval(() => {
      try { lease.touch(); } catch (error) { heartbeatError = error; }
    }, 20_000);
    heartbeat.unref();
    let progress = null;
    function assertOwner() {
      if (heartbeatError) throw heartbeatError;
      lease.touch();
    }
    function saveProgress(value) {
      assertOwner();
      state.saveProgress({ ...value, updatedAt: new Date(now()).toISOString() });
    }
    try {
      const provider = options.provider || getProvider('nexus');
      if (!provider) throw new Error('No mod provider configured');
      // Also persist explicitly supplied jobs before doing any external work.
      if (items.length) jobQueue.addJobs(items, provider.id);
      const results = state.getResults();
      const processed = state.getProcessed();
      const resultsByKey = new Map(results.filter(item => item?.key).map(item => [item.key, item]));
      const oldRecords = new Map(processed.filter(item => item?.key).map(item => [item.key, item]));

      async function checkpoint(result) {
        assertOwner();
        if (result.status === STATUSES.BUILT && !await validBuiltResult(result)) throw new Error('Builder did not produce a verified archive');
        resultsByKey.set(result.key, result);
        upsertByKey(results, result);
        // Results are authoritative; the other two documents are projections.
        state.saveResults(results);
        upsertByKey(processed, result);
        state.saveProcessed(processed);
        jobQueue.updateJob(result.key, {
          nexusModId: result.nexusModId, status: result.status, attempts: result.attempts,
          error: result.error || null, nextAttemptAt: result.nextAttemptAt || null,
          outputFile: result.outputFile || null
        });
      }
      function summarize(extra = {}) {
        const queued = jobQueue.load();
        const counts = {};
        for (const job of queued) {
          const status = resultsByKey.get(job.key)?.status || job.status || 'queued';
          counts[status] = (counts[status] || 0) + 1;
        }
        const completed = Object.entries(counts).filter(([status]) => isTerminalStatus(status)).reduce((sum, [, count]) => sum + count, 0);
        return {
          ...progress, ...extra,
          total: queued.length, processed: completed, remaining: queued.length - completed,
          built: counts.built || 0, noTranslations: counts.translation_missing || 0,
          failed: counts.retry_exhausted || 0, queue: counts
        };
      }
      progress = summarize({
        running: true, status: 'processing', attempted: 0, current: null,
        logs: [], startedAt: new Date(now()).toISOString(), finishedAt: null,
        worker: { pid: process.pid, lease: lease.token }, error: null
      });
      saveProgress(progress);
      const processMod = createModProcessingPipeline({
        provider, translationFinder: options.translationFinder || findTranslation,
        builder: options.builder || buildReadyMod, outputDir: paths.outputDir,
        onCheckpoint: checkpoint
      });

      for (const input of items) {
        assertOwner();
        const key = processingKey(input, provider.id);
        // The queue may have been enriched by a concurrent import.
        const mod = jobQueue.load().find(item => item.key === key) || { ...input, key };
        let previous = resultsByKey.get(key) || oldRecords.get(key);
        if (isTerminalStatus(previous?.status)) {
          if (previous.status !== STATUSES.BUILT || await validBuiltResult(previous)) {
            await checkpoint(previous);
            continue;
          }
          previous = { ...previous, status: STATUSES.ERROR, attempts: 0, nextAttemptAt: null, error: 'Built artifact missing or invalid; rebuilding' };
          await checkpoint(previous);
          mod.attempts = 0;
        }
        if (previous?.nextAttemptAt && Date.parse(previous.nextAttemptAt) > now()) continue;
        const attempts = Math.max(Number(previous?.attempts || 0), Number(mod.attempts || 0));
        if (attempts >= maxAttempts) {
          await checkpoint({ ...previous, key, name: mod.name, game: mod.game, status: STATUSES.RETRY_EXHAUSTED, attempts, nextAttemptAt: null, error: previous?.error || 'retry_exhausted' });
          continue;
        }

        const started = {
          ...previous, key, name: mod.name, author: mod.author, game: mod.game,
          provider: provider.id, nexusModId: mod.nexusModId || previous?.nexusModId || null,
          status: 'processing', attempts: attempts + 1, nextAttemptAt: null,
          error: null, updatedAt: new Date(now()).toISOString()
        };
        await checkpoint(started);
        progress.current = mod.name || mod.nexusModId || key;
        progress.attempted += 1;
        state.appendLog('info', 'Processing job', { key, attempt: started.attempts });
        saveProgress(summarize());
        const context = await processMod({ ...mod, key }, started);
        let result = { ...context.result, attempts: started.attempts, updatedAt: new Date(now()).toISOString() };
        if (result.status === STATUSES.ERROR) {
          const exhausted = result.attempts >= maxAttempts;
          result = {
            ...result, status: exhausted ? STATUSES.RETRY_EXHAUSTED : STATUSES.ERROR,
            nextAttemptAt: exhausted ? null : new Date(now() + Math.min(retryBaseMs * 2 ** (result.attempts - 1), 60 * 60 * 1000)).toISOString()
          };
          state.appendError(new Error(result.error || result.status), { key, game: result.game, attempt: result.attempts });
        }
        await checkpoint(result);
        state.appendLog(result.status === STATUSES.ERROR || result.status === STATUSES.RETRY_EXHAUSTED ? 'error' : 'info', 'Job checkpoint committed', { key, status: result.status });
        progress = summarize();
        saveProgress(progress);
      }
      progress = summarize({ running: false, current: null, worker: null, finishedAt: new Date(now()).toISOString() });
      progress.status = progress.total === 0 ? 'empty_queue' : progress.remaining === 0 ? 'finished' : 'waiting_retry';
      saveProgress(progress);
      return results;
    } catch (error) {
      // A lost lease must not overwrite the new owner's state.
      if (error.code !== 'WORKER_BUSY') {
        try {
          saveProgress({ ...progress, running: false, status: 'error', current: null, worker: null, error: error.message });
          state.appendLog('error', 'Worker stopped', { error: error.message });
        } catch (_) { /* Preserve the original storage/processing failure. */ }
      }
      throw error;
    } finally {
      clearInterval(heartbeat);
      lease.release();
    }
  }

  return {
    processQueue,
    start: (settings = {}) => processQueue(Array.isArray(settings.queue) ? settings.queue : jobQueue.load())
  };
}
const worker = createWorker();
module.exports = { ...worker, createWorker, loadQueue: jobQueue.load, isTerminalStatus, TERMINAL_STATUSES, validBuiltResult };
