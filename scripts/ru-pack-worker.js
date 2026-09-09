const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const { findTranslation } = require('./find-translation');
const { buildReadyMod } = require('../lib/build-pipeline');
const { STATUSES, setStatus } = require('../lib/mod-status');
const state = require('../lib/state-store');
const jobQueue = require('../lib/job-queue');
const { getProvider } = require('../providers/provider-registry');
const { createModProcessingPipeline, processingKey } = require('../lib/mod-processing-pipeline');
const { acquireWorkerLock } = require('../lib/worker-lock');
require('../providers/nexus-provider');

const WORK = paths.workDir;
const PROGRESS = path.join(WORK, 'progress.json');
const RESULT = path.join(WORK, 'ru_results.json');
const OUTPUT = paths.outputDir;
const MAX_ATTEMPTS = Math.max(1, Number(process.env.NEXUS_LOADER_MAX_ATTEMPTS || 3));
const TERMINAL_STATUSES = new Set([
  STATUSES.BUILT,
  STATUSES.NOT_FOUND,
  STATUSES.MULTIPLE_MATCHES,
  STATUSES.TRANSLATION_MISSING,
  STATUSES.NEEDS_REVIEW,
  STATUSES.RETRY_EXHAUSTED
]);

function isTerminalStatus(status) { return TERMINAL_STATUSES.has(status); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, file);
}
function saveProgress(data, lease) {
  const value = { ...data, updatedAt: new Date().toISOString() };
  save(PROGRESS, value);
  state.saveProgress(value);
  if (lease) lease.touch();
}
function addLog(progress, text) {
  progress.logs = progress.logs || [];
  progress.logs.push(`${new Date().toISOString()} ${text}`);
  if (progress.logs.length > 300) progress.logs = progress.logs.slice(-300);
}
function loadQueue() { return jobQueue.load(); }
function upsertByKey(list, value) {
  const index = list.findIndex(item => item?.key && item.key === value.key);
  if (index >= 0) list[index] = value;
  else list.push(value);
}

async function processQueue(items) {
  if (!items.length) {
    saveProgress({ running: false, status: 'empty_queue', total: 0, processed: 0, remaining: 0 });
    return [];
  }

  const lease = acquireWorkerLock();
  try {
    fs.mkdirSync(OUTPUT, { recursive: true });
    const provider = getProvider('nexus');
    if (!provider) throw new Error('No mod provider configured');
    const processMod = createModProcessingPipeline({ provider, translationFinder: findTranslation, builder: buildReadyMod, outputDir: OUTPUT });

    let results = readJson(RESULT, []);
    let processed = state.getProcessed();
    const records = new Map(processed.filter(item => item?.key).map(item => [item.key, item]));
    const queueKeys = items.map(item => processingKey(item, provider.id));
    let completed = queueKeys.filter(key => isTerminalStatus(records.get(key)?.status)).length;
    const previousProgress = state.getProgress();
    let progress = {
      ...previousProgress,
      running: true,
      status: 'processing',
      total: items.length,
      processed: completed,
      remaining: Math.max(0, items.length - completed),
      attempted: 0,
      worker: { pid: process.pid, lease: lease.token },
      logs: previousProgress.logs || [],
      startedAt: new Date().toISOString(),
      finishedAt: null
    };
    saveProgress(progress, lease);

    for (let index = 0; index < items.length; index += 1) {
      const mod = items[index];
      const key = queueKeys[index];
      const previous = records.get(key);
      if (isTerminalStatus(previous?.status)) {
        jobQueue.updateJob(key, { status: previous.status, attempts: previous.attempts || 0, error: previous.error || null, nexusModId: previous.nexusModId || mod.nexusModId || null });
        continue;
      }

      const attempts = Number(previous?.attempts || 0);
      if (previous?.status === STATUSES.ERROR && attempts >= MAX_ATTEMPTS) {
        const exhausted = { ...previous, status: STATUSES.RETRY_EXHAUSTED, error: previous.error || 'retry_exhausted', updatedAt: new Date().toISOString() };
        records.set(key, exhausted);
        upsertByKey(processed, exhausted);
        state.saveProcessed(processed);
        jobQueue.updateJob(key, { status: exhausted.status, attempts, error: exhausted.error });
        completed += 1;
        progress.processed = completed;
        progress.remaining = Math.max(0, progress.total - completed);
        saveProgress(progress, lease);
        continue;
      }

      progress.current = mod.name || mod.title || mod.nexusModId || mod.modId || key;
      progress.index = index;
      progress.attempted = Number(progress.attempted || 0) + 1;
      addLog(progress, `Processing ${progress.current} [${key}]`);
      jobQueue.updateJob(key, { status: 'processing', attempts, error: null });
      saveProgress(progress, lease);

      const context = await processMod(mod);
      let result = context.result;
      const nextAttempts = attempts + 1;
      if (result.status === STATUSES.ERROR && nextAttempts >= MAX_ATTEMPTS) {
        result = setStatus(result, STATUSES.RETRY_EXHAUSTED, { error: result.error || 'retry_exhausted' });
        context.result = result;
      }
      if (result.status === STATUSES.ERROR || result.status === STATUSES.RETRY_EXHAUSTED) {
        state.appendError(new Error(result.error || result.status), { key, game: result.game, provider: result.provider, nexusModId: result.nexusModId, attempt: nextAttempts });
      }

      const record = {
        key,
        name: result.name,
        author: result.author,
        game: result.game,
        provider: result.provider,
        nexusModId: result.nexusModId,
        status: result.status,
        attempts: nextAttempts,
        error: result.error || null,
        updatedAt: new Date().toISOString()
      };
      records.set(key, record);
      upsertByKey(processed, record);
      upsertByKey(results, result);
      state.saveProcessed(processed);
      save(RESULT, results);
      jobQueue.updateJob(key, { name: result.name, author: result.author, game: result.game, nexusModId: result.nexusModId, status: result.status, attempts: nextAttempts, error: result.error || null, outputFile: result.outputFile || null });
      if (isTerminalStatus(result.status)) completed += 1;
      progress.processed = completed;
      progress.remaining = Math.max(0, progress.total - completed);
      saveProgress(progress, lease);
    }

    const finalStatus = progress.remaining === 0 ? 'finished' : 'waiting_retry';
    saveProgress({ ...progress, running: false, status: finalStatus, current: null, worker: null, finishedAt: new Date().toISOString() }, lease);
    return results;
  } finally {
    lease.release();
  }
}

async function start(options = {}) { return processQueue(options.queue && options.queue.length ? options.queue : loadQueue()); }
module.exports = { start, processQueue, loadQueue, isTerminalStatus, TERMINAL_STATUSES };
