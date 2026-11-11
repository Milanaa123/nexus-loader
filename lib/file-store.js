const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function storageError(file, message, cause) {
  const error = new Error(message + ': ' + file, { cause });
  error.code = 'STORAGE_CORRUPT';
  return error;
}

// Missing is the only condition that permits a default. Never hide damaged state.
function readJson(file, fallback, validate = () => true) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  let value;
  try { value = JSON.parse(text); }
  catch (error) { throw storageError(file, 'Invalid JSON; original file preserved', error); }
  if (!validate(value)) throw storageError(file, 'Invalid document shape; original file preserved');
  return value;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') {
      const directory = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    }
    return value;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function processIsDead(owner) {
  if (owner?.host !== os.hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0) return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}

// Transactions contain synchronous local IO only, never network operations or awaits.
function withFileLock(file, transaction, timeoutMs = 5000) {
  const lock = file + '.lock';
  const ownerFile = path.join(lock, process.pid + '-' + crypto.randomUUID() + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  while (true) {
    try {
      fs.mkdirSync(lock);
      try { fs.writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, host: os.hostname() }), { flag: 'wx', mode: 0o600 }); }
      catch (error) { try { fs.rmdirSync(lock); } catch (_) {} throw error; }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const owners = fs.readdirSync(lock).filter(name => /^\d+-[a-f0-9-]+\.json$/.test(name));
        if (owners.length === 1) {
          const staleFile = path.join(lock, owners[0]);
          let owner = null;
          try { owner = JSON.parse(fs.readFileSync(staleFile, 'utf8')); }
          catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error; }
          if (processIsDead(owner)) {
            // Only the reclaimer that removed this unique owner may remove the directory.
            fs.unlinkSync(staleFile);
            fs.rmdirSync(lock);
            continue;
          }
        }
      } catch (recoveryError) {
        if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(recoveryError.code)) throw recoveryError;
      }
      if (Date.now() >= deadline) {
        const busy = new Error('Storage transaction lock is busy; no data changed: ' + lock);
        busy.code = 'STORAGE_BUSY';
        throw busy;
      }
      Atomics.wait(pause, 0, 0, 10);
    }
  }
  try {
    const result = transaction();
    if (result && typeof result.then === 'function') throw new Error('File store transactions must be synchronous');
    return result;
  } finally {
    fs.unlinkSync(ownerFile);
    fs.rmdirSync(lock);
  }
}

function readMigrated(file, legacyFiles, fallback, validate) {
  const current = readJson(file, undefined, validate);
  if (current !== undefined) return current;
  return withFileLock(file, () => {
    const latest = readJson(file, undefined, validate);
    if (latest !== undefined) return latest;
    for (const legacy of legacyFiles.filter(value => value !== file)) {
      const value = readJson(legacy, undefined, validate);
      if (value !== undefined) return writeJson(file, value);
    }
    return fallback;
  });
}

module.exports = { readJson, writeJson, withFileLock, readMigrated, storageError };
