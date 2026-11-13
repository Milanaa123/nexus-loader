const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const paths = require('../config/paths');
const client = require('../providers/nexus-client');
const { validateArchiveFile } = require('../lib/archive-utils');
const { digestFile } = require('../lib/file-integrity');
const { readJson, writeJson } = require('../lib/file-store');

function ensure() {
  for (const directory of [paths.downloadsDir, paths.originalsDir, paths.translationsDir]) fs.mkdirSync(directory, { recursive: true });
}
function safeFileName(value, fallback) {
  const cleaned = String(value || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 160);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
}
async function validCachedFile(file, options = {}) {
  if (!file) return false;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) return false;
    const metadata = readJson(file + '.meta.json', null);
    const expected = options.expectedSha256 || metadata?.sha256;
    if (expected && await digestFile(file) !== expected) return false;
    const validation = await validateArchiveFile(file);
    return Boolean(validation.readable && validation.nonEmpty);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'STORAGE_CORRUPT') return false;
    throw error;
  }
}
function activeFile(file) { return file && file.file_id && !/^(?:ARCHIVED|REMOVED|OLD[_ ]?(?:VERSION|FILES))$/i.test(String(file.category_name || '')); }
function selectionError(game, modId, files) {
  return client.failure('NEXUS_FILE_SELECTION', 'More than one active file requires an explicit fileId', false, {
    action: { type: 'select_nexus_file', game, modId: String(modId), candidates: files.slice(0, 20).map(file => ({ fileId: String(file.file_id), name: file.file_name || file.name || '', category: file.category_name || null, version: file.version || null })) }
  });
}
async function chooseFile(game, modId) {
  const files = await client.getFiles({ game, modId });
  const usable = files.filter(activeFile);
  if (!usable.length) throw client.failure('NEXUS_FILE_UNAVAILABLE', 'No active downloadable files for this mod');
  const primary = usable.filter(file => file.is_primary === true || file.is_primary === 1);
  const main = usable.filter(file => String(file.category_name || '').toUpperCase() === 'MAIN');
  const preferred = primary.length ? primary : main.length ? main : usable;
  if (preferred.length !== 1) throw selectionError(game, modId, preferred);
  return preferred[0];
}
function identity(value, label) {
  const normalized = String(value || '');
  if (!/^[1-9]\d*$/.test(normalized)) throw new Error('Invalid Nexus ' + label);
  return normalized;
}
async function downloadMod({ game, modId, fileId, role }) {
  if (!/^[a-z0-9_-]+$/i.test(String(game || ''))) throw new Error('Valid game domain is required for Nexus download');
  modId = identity(modId, 'modId');
  if (fileId) fileId = identity(fileId, 'fileId');
  ensure();
  let selected;
  if (fileId) {
    const files = await client.getFiles({ game, modId });
    selected = files.find(file => String(file.file_id) === String(fileId));
    if (!activeFile(selected)) throw client.failure('NEXUS_FILE_UNAVAILABLE', 'The selected Nexus file is missing or inactive');
  } else selected = await chooseFile(game, modId);
  const fid = identity(selected.file_id, 'fileId');
  const sourceName = selected.file_name || selected.name || (modId + '-' + fid + '.bin');
  const fileName = safeFileName(game, 'game') + '-' + modId + '-' + fid + '-' + safeFileName(sourceName, 'download.bin');
  const directory = role === 'original' ? paths.originalsDir : role === 'translation' ? paths.translationsDir : paths.downloadsDir;
  let target = path.join(directory, fileName);
  for (const candidate of [...new Set([target, path.join(paths.downloadsDir, fileName)])]) {
    if (await validCachedFile(candidate)) {
      return { path: candidate, game, modId, fileId: fid, fileName: sourceName, size: fs.statSync(candidate).size, sha256: await digestFile(candidate), cached: true };
    }
  }
  // Never overwrite an existing damaged download. Retain it for investigation.
  if (fs.existsSync(target)) {
    const extension = path.extname(target);
    target = target.slice(0, -extension.length || undefined) + '.repair-' + crypto.randomUUID() + extension;
  }
  const links = await client.getDownloadLinks({ game, modId, fileId: fid });
  const link = links[0]?.URI || links[0]?.uri;
  if (!link) throw new Error('No download link for ' + game + ' mod ' + modId + ' file ' + fid);
  let url; try { url = new URL(link); } catch { /* Invalid link is rejected below. */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password) throw client.failure('NEXUS_RESPONSE_INVALID', 'Nexus returned an unsafe download URL');
  let lastError;
  const maxBytes = Number(process.env.NEXUS_LOADER_MAX_DOWNLOAD_BYTES || 1024 * 1024 * 1024);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Invalid NEXUS_LOADER_MAX_DOWNLOAD_BYTES');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const temporary = target + '.partial-' + crypto.randomUUID() + path.extname(target);
    try {
      const response = await client.request(link, {}, 1);
      const contentType = response.headers.get('content-type') || '';
      if (/text\/html|application\/(?:json|problem\+json)/i.test(contentType)) {
        const error = new Error('Download returned an error document instead of a mod file');
        error.code = 'INVALID_DOWNLOAD';
        throw error;
      }
      if (!response.body) throw new Error('Download returned no body');
      let size = 0;
      const limit = new Transform({
        transform(chunk, encoding, callback) {
          size += chunk.length;
          if (size > maxBytes) callback(new Error('Download exceeds NEXUS_LOADER_MAX_DOWNLOAD_BYTES'));
          else callback(null, chunk);
        }
      });
      const expectedLength = Number(response.headers.get('content-length'));
      if (expectedLength > maxBytes) throw new Error('Download exceeds NEXUS_LOADER_MAX_DOWNLOAD_BYTES');
      await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      if (!size) throw new Error('Downloaded empty file');
      if (expectedLength && !response.headers.get('content-encoding') && expectedLength !== size) throw new Error('Incomplete download: Content-Length mismatch');
      const validation = await validateArchiveFile(temporary);
      if (!validation.readable || !validation.nonEmpty) throw new Error('Downloaded archive is invalid: ' + (validation.error || 'empty archive'));
      const sha256 = await digestFile(temporary);
      const result = { path: target, game, modId, fileId: fid, fileName: sourceName, size, sha256, cached: false, contentType };
      // Exclusive publication: another writer must never be overwritten.
      fs.linkSync(temporary, target);
      writeJson(target + '.meta.json', result);
      return result;
    } catch (error) {
      lastError = error;
      if (error.retryable === false || error.retryAfterMs > 3000 || error.code === 'INVALID_DOWNLOAD' || (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429)) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, Math.max(250 * attempt, error.retryAfterMs || 0)));
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const safeMessage = lastError?.code?.startsWith('NEXUS_') || /^(?:Download returned|Download exceeds|Downloaded empty file|Incomplete download|Downloaded archive is invalid)/.test(lastError?.message || '') ? lastError.message : 'Archive transfer failed';
  const error = new Error('Download failed for ' + game + ' mod ' + modId + ' file ' + fid + ': ' + safeMessage);
  error.code = lastError?.code || 'DOWNLOAD_FAILED';
  error.retryable = lastError?.retryable ?? true;
  error.action = lastError?.action || null;
  error.retryAfterMs = lastError?.retryAfterMs || null;
  throw error;
}
module.exports = { downloadMod, ensure, chooseFile, validCachedFile };
