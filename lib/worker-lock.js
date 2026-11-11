const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const paths = require('../config/paths');
const { withFileLock } = require('./file-store');

class WorkerBusyError extends Error {
  constructor(details = null) {
    super('Another Nexus Loader worker owns the processing lease');
    this.name = 'WorkerBusyError';
    this.code = 'WORKER_BUSY';
    this.details = details;
  }
}

function lockFile() {
  return paths.workerLockFile;
}

function ttlMs() {
  return Math.max(60_000, Number(process.env.NEXUS_LOADER_WORKER_LOCK_TTL_MS || 6 * 60 * 60 * 1000));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readLease(file = lockFile()) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function heartbeatTime(lease) {
  const value = Date.parse(lease?.heartbeatAt || lease?.acquiredAt || '');
  return Number.isFinite(value) ? value : 0;
}

function isStale(lease, now = Date.now(), maxAge = ttlMs()) {
  if (lease?.host === os.hostname() && Number.isInteger(lease.pid) && lease.pid > 0) {
    try { process.kill(lease.pid, 0); return false; }
    catch (error) { if (error.code === 'ESRCH') return true; }
  }
  const heartbeat = heartbeatTime(lease);
  return !heartbeat || now - heartbeat > maxAge;
}

function archiveStaleLease(file) {
  const stale = `${file}.stale-${Date.now()}-${process.pid}`;
  fs.renameSync(file, stale);
  return stale;
}

function writeLeaseExclusive(file, lease) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(lease, null, 2), 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function replaceLease(file, lease) {
  const temp = `${file}.${process.pid}.${lease.token}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(lease, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

function acquireWorkerLockUnsafe(options = {}) {
  const file = options.file || lockFile();
  const maxAge = Math.max(1000, Number(options.ttlMs || ttlMs()));
  ensureDir(file);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date().toISOString();
    const lease = {
      token: crypto.randomUUID(),
      pid: process.pid,
      host: os.hostname(),
      acquiredAt: now,
      heartbeatAt: now
    };
    try {
      writeLeaseExclusive(file, lease);
      let released = false;
      return {
        file,
        token: lease.token,
        lease,
        touch() {
          if (released) return false;
          return withFileLock(file, () => {
            const current = readLease(file);
            if (!current || current.token !== lease.token) throw new WorkerBusyError(current);
            lease.heartbeatAt = new Date().toISOString();
            replaceLease(file, lease);
            return true;
          });
        },
        release() {
          if (released) return false;
          released = true;
          return withFileLock(file, () => {
            const current = readLease(file);
            if (!current || current.token !== lease.token) return false;
            try { fs.unlinkSync(file); return true; } catch (_) { return false; }
          });
        }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const current = readLease(file);
      if (attempt === 0 && isStale(current, Date.now(), maxAge)) {
        try { archiveStaleLease(file); continue; }
        catch (renameError) {
          if (renameError.code === 'ENOENT') continue;
        }
      }
      throw new WorkerBusyError(current);
    }
  }
  throw new WorkerBusyError(readLease(file));
}

function acquireWorkerLock(options = {}) {
  const file = options.file || lockFile();
  return withFileLock(file, () => acquireWorkerLockUnsafe({ ...options, file }));
}

module.exports = { WorkerBusyError, acquireWorkerLock, readLease, isStale, lockFile };
