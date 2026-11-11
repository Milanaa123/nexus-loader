const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const { readMigrated, readJson, writeJson, withFileLock } = require('./file-store');

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const definitions = {
  progress: { file: paths.progressFile, legacy: [path.join(paths.legacyStateDir, 'progress.json'), paths.legacyProgressFile], fallback: {}, validate: object },
  processed: { file: paths.processedFile, legacy: [path.join(paths.legacyStateDir, 'processed.json')], fallback: [], validate: Array.isArray },
  results: { file: paths.resultsFile, legacy: [paths.legacyResultsFile], fallback: [], validate: Array.isArray },
  errors: { file: paths.errorsFile, legacy: [path.join(paths.legacyStateDir, 'errors.json')], fallback: [], validate: Array.isArray }
};

function read(name) {
  const entry = definitions[name];
  return readMigrated(entry.file, entry.legacy, structuredClone(entry.fallback), entry.validate);
}
function write(name, value) {
  const entry = definitions[name];
  if (!entry.validate(value)) throw new Error('Invalid ' + name + ' state');
  return withFileLock(entry.file, () => writeJson(entry.file, value));
}
function appendError(error, details = {}) {
  read('errors');
  return withFileLock(paths.errorsFile, () => {
    const errors = readJson(paths.errorsFile, [], Array.isArray);
    errors.push({ ...details, message: error?.message || String(error), code: error?.code || null, date: new Date().toISOString() });
    return writeJson(paths.errorsFile, errors);
  });
}
function appendLog(level, message, details = {}) {
  fs.mkdirSync(paths.logsDir, { recursive: true });
  const entry = { ...details, level, message, at: new Date().toISOString() };
  const file = path.join(paths.logsDir, 'worker-' + entry.at.slice(0, 10) + '.jsonl');
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
}

module.exports = {
  getProgress: () => read('progress'),
  saveProgress: value => write('progress', value),
  getProcessed: () => read('processed'),
  saveProcessed: value => write('processed', value),
  getResults: () => read('results'),
  saveResults: value => write('results', value),
  getErrors: () => read('errors'),
  saveErrors: value => write('errors', value),
  appendError,
  appendLog
};
