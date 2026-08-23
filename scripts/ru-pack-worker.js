const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');
const { findTranslation } = require('./find-translation');
const { run: importQueue } = require('./import_mod_queue');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveProgress(data) {
  fs.mkdirSync(WORK, {recursive:true});
  fs.writeFileSync(PROGRESS, JSON.stringify({...data, updatedAt:new Date().toISOString()}, null, 2));
}
function loadQueue() {
  if (!fs.existsSync(QUEUE)) importQueue();
  const q = readJson(QUEUE, {items:[]});
  return Array.isArray(q) ? q : (q.items || q.mods || []);
}

async function processQueue(items) {
  if (!items.length) {
    saveProgress({running:false,status:'empty_queue',total:0,processed:0});
    return;
  }

  ensure();
  let progress = readJson(PROGRESS, {});
  progress = { ...progress, running:true, status:'processing', total:items.length, logs:progress.logs || [] };
  saveProgress(progress);

  for (let i = progress.processed || 0; i < items.length; i++) {
    const mod = items[i];
    progress.current = mod.name || mod.modId || String(i);
    progress.logs.push(`Поиск русификатора: ${progress.current}`);
    saveProgress(progress);

    try {
      const translation = await findTranslation(mod);
      if (translation) {
        mod.translationId = translation.id;
        progress.logs.push(`Русификатор найден ID: ${translation.id}`);
      } else {
        progress.logs.push('Русификатор не найден');
      }

      const result = await downloadMod(mod);
      if (result) progress.downloaded = (progress.downloaded || 0) + 1;

    } catch (e) {
      progress.failed = (progress.failed || 0) + 1;
      progress.logs.push(`Ошибка: ${e.message}`);
    }

    progress.processed = i + 1;
    progress.remaining = progress.total - progress.processed;
    saveProgress(progress);
  }

  saveProgress({...progress, running:false, status:'finished', current:null});
}

async function start(options={}) {
  return processQueue(options.queue && options.queue.length ? options.queue : loadQueue());
}

module.exports = { start, processQueue };
