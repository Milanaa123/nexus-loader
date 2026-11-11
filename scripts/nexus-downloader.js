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
async function chooseFile(game, modId) {
  const files = await client.getFiles({ game, modId });
  const usable = files.filter(file => file && file.file_id && !['ARCHIVED', 'REMOVED'].includes(String(file.category_name || '').toUpperCase()));
  if (!usable.length) throw new Error('No downloadable files for ' + game + ' mod ' + modId);
  usable.sort((a, b) =>
    Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
    Number(String(b.category_name || '').toUpperCase() === 'MAIN') - Number(String(a.category_name || '').toUpperCase() === 'MAIN') ||
    Number(b.uploaded_timestamp || 0) - Number(a.uploaded_timestamp || 0)
  );
  return usable[0];
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
    selected = files.find(file => String(file.file_id) === String(fileId)) || { file_id: fileId };
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
      if (error.code === 'INVALID_DOWNLOAD' || (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429)) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const error = new Error('Download failed for ' + game + ' mod ' + modId + ' file ' + fid + ': ' + (lastError?.message || 'unknown error'), { cause: lastError });
  error.code = lastError?.code || 'DOWNLOAD_FAILED';
  throw error;
}
module.exports = { downloadMod, ensure, chooseFile, validCachedFile };
