const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('../config/paths');
const client = require('../providers/nexus-client');

const DOWNLOADS = path.join(paths.workDir, 'downloads');
function ensure() { fs.mkdirSync(DOWNLOADS, { recursive: true }); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function safeFileName(value, fallback) { const cleaned = String(value || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim(); return cleaned || fallback; }
function validCachedFile(file) { return fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0; }

async function chooseFile(game, modId) {
  const files = await client.getFiles({ game, modId });
  const usable = files.filter(file => file && file.file_id && !['ARCHIVED', 'REMOVED'].includes(String(file.category_name || '').toUpperCase()));
  if (!usable.length) throw new Error(`No downloadable files for ${game} mod ${modId}`);
  usable.sort((a, b) => {
    const primary = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
    if (primary) return primary;
    const main = Number(String(b.category_name || '').toUpperCase() === 'MAIN') - Number(String(a.category_name || '').toUpperCase() === 'MAIN');
    if (main) return main;
    return Number(b.uploaded_timestamp || 0) - Number(a.uploaded_timestamp || 0);
  });
  return usable[0];
}

async function downloadMod({ game, modId, fileId }) {
  if (!game) throw new Error('game is required for Nexus download');
  if (!modId) throw new Error('modId missing');
  ensure();
  let selected;
  if (fileId) {
    const files = await client.getFiles({ game, modId });
    selected = files.find(file => Number(file.file_id) === Number(fileId)) || { file_id: Number(fileId) };
  } else selected = await chooseFile(game, modId);
  const fid = Number(selected.file_id);
  if (!fid) throw new Error(`No fileId for ${game} mod ${modId}`);
  const sourceName = selected.file_name || selected.name || `${modId}-${fid}.bin`;
  const fileName = `${safeFileName(game, 'game')}-${modId}-${fid}-${safeFileName(sourceName, 'download.bin')}`;
  const target = path.join(DOWNLOADS, fileName);
  if (validCachedFile(target)) {
    return { path: target, game, modId: String(modId), fileId: String(fid), fileName: sourceName, size: fs.statSync(target).size, sha256: sha256(target), cached: true };
  }
  const links = await client.getDownloadLinks({ game, modId, fileId: fid });
  const link = links[0]?.URI || links[0]?.uri;
  if (!link) throw new Error(`No download link for ${game} mod ${modId} file ${fid}`);
  const response = await client.request(link, {}, 3);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`Downloaded empty file for ${game} mod ${modId} file ${fid}`);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, buffer);
  fs.renameSync(temp, target);
  return { path: target, game, modId: String(modId), fileId: String(fid), fileName: sourceName, size: buffer.length, sha256: sha256(target), cached: false, contentType: response.headers.get('content-type') || null };
}

module.exports = { downloadMod, ensure, chooseFile, validCachedFile };
