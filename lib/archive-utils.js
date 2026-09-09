const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');
const unrar = require('node-unrar-js');
const { path7za } = require('7zip-bin');
const paths = require('../config/paths');

const SEVEN_ZIP_TYPES = new Set(['7z', 'tar', 'gz', 'bz2', 'xz']);

function safeArchivePath(value) {
  const raw = String(value || '').replace(/\\/g, '/');
  if (!raw || raw.includes('\0') || raw.startsWith('/') || /^[a-z]:/i.test(raw)) {
    throw new Error(`Unsafe archive entry: ${value}`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Unsafe archive entry: ${value}`);
  }
  return normalized;
}

function archiveType(file) {
  const lower = String(file || '').toLowerCase();
  if (/\.tar\.gz$|\.tgz$/.test(lower)) return 'tar.gz';
  if (/\.tar\.bz2$|\.tbz2?$/.test(lower)) return 'tar.bz2';
  if (/\.tar\.xz$|\.txz$/.test(lower)) return 'tar.xz';
  const ext = path.extname(lower).slice(1);
  if (['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return ext;

  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const header = fs.readFileSync(file).subarray(0, 8).toString('hex');
  if (header.startsWith('504b')) return 'zip';
  if (header.startsWith('52617221')) return 'rar';
  if (header.startsWith('377abcaf271c')) return '7z';
  return null;
}

function ensureTempRoot() {
  fs.mkdirSync(paths.tempDir, { recursive: true });
}

function makeTempDir(label = 'archive') {
  ensureTempRoot();
  return fs.mkdtempSync(path.join(paths.tempDir, `${label}-`));
}

function ensure7zaExecutable() {
  if (process.platform !== 'win32' && fs.existsSync(path7za)) {
    try { fs.chmodSync(path7za, 0o755); } catch (_) {}
  }
  return path7za;
}

function run7za(args) {
  const binary = ensure7zaExecutable();
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || '').trim().slice(-1200);
    throw new Error(`7zip failed (${result.status}): ${details}`);
  }
  return result.stdout || '';
}

function list7zaEntries(file) {
  const output = run7za(['l', '-slt', file]);
  const entries = output.split(/\r?\n/)
    .filter(line => line.startsWith('Path = '))
    .map(line => line.slice(7).trim());
  if (entries.length > 1) return entries.slice(1);
  return [];
}

function validate7zaEntries(file) {
  for (const entry of list7zaEntries(file)) safeArchivePath(entry);
}

function extractZip(file, target) {
  const zip = new AdmZip(file);
  const entries = zip.getEntries();
  for (const entry of entries) safeArchivePath(entry.entryName);
  zip.extractAllTo(target, true);
  return entries.length;
}

async function extractRar(file, target) {
  const extractor = await unrar.createExtractorFromFile({
    filepath: file,
    targetPath: target,
    filenameTransform: safeArchivePath
  });
  const listing = extractor.getFileList();
  const headers = [...listing.fileHeaders];
  for (const header of headers) safeArchivePath(header.name);
  const extracted = extractor.extract();
  [...extracted.files];
  return headers.length;
}

function extract7za(file, target, type) {
  validate7zaEntries(file);
  run7za(['x', '-y', `-o${target}`, file]);

  if (type === 'tar.gz' || type === 'tar.bz2' || type === 'tar.xz') {
    const tar = fs.readdirSync(target)
      .map(name => path.join(target, name))
      .find(candidate => candidate.toLowerCase().endsWith('.tar') && fs.statSync(candidate).isFile());
    if (!tar) throw new Error(`Compressed tar did not produce a .tar file: ${file}`);
    validate7zaEntries(tar);
    run7za(['x', '-y', `-o${target}`, tar]);
    fs.rmSync(tar, { force: true });
  }
}

function copyPlainFile(file, target) {
  const name = safeArchivePath(path.basename(file));
  fs.copyFileSync(file, path.join(target, name));
}

async function prepareSource(source, label = 'source') {
  if (!source || !fs.existsSync(source)) throw new Error(`Source does not exist: ${source}`);
  const stat = fs.statSync(source);
  if (stat.isDirectory()) return { dir: source, temporary: false, type: 'directory', source };
  if (!stat.isFile()) throw new Error(`Unsupported source type: ${source}`);

  const type = archiveType(source);
  const dir = makeTempDir(label);
  try {
    if (type === 'zip') extractZip(source, dir);
    else if (type === 'rar') await extractRar(source, dir);
    else if (SEVEN_ZIP_TYPES.has(type) || ['tar.gz', 'tar.bz2', 'tar.xz'].includes(type)) extract7za(source, dir, type);
    else copyPlainFile(source, dir);
    return { dir, temporary: true, type: type || 'file', source };
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function cleanupPreparedSource(prepared) {
  if (!prepared?.temporary || !prepared.dir) return;
  try { fs.rmSync(prepared.dir, { recursive: true, force: true }); } catch (_) {}
}

async function validateArchiveFile(file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return { exists: false, readable: false, type: null, entries: 0 };
  const type = archiveType(file);
  try {
    if (type === 'zip') {
      const zip = new AdmZip(file);
      const entries = zip.getEntries();
      entries.forEach(entry => safeArchivePath(entry.entryName));
      return { exists: true, readable: true, type, entries: entries.length, nonEmpty: entries.length > 0 };
    }
    if (type === 'rar') {
      const extractor = await unrar.createExtractorFromFile({ filepath: file });
      const listing = extractor.getFileList();
      const headers = [...listing.fileHeaders];
      headers.forEach(header => safeArchivePath(header.name));
      return { exists: true, readable: true, type, entries: headers.length, nonEmpty: headers.length > 0 };
    }
    if (SEVEN_ZIP_TYPES.has(type) || ['tar.gz', 'tar.bz2', 'tar.xz'].includes(type)) {
      const entries = list7zaEntries(file);
      entries.forEach(safeArchivePath);
      return { exists: true, readable: true, type, entries: entries.length, nonEmpty: entries.length > 0 };
    }
    return { exists: true, readable: true, type: 'file', entries: 1, nonEmpty: fs.statSync(file).size > 0 };
  } catch (error) {
    return { exists: true, readable: false, type, entries: 0, nonEmpty: false, error: error.message };
  }
}

module.exports = {
  safeArchivePath,
  archiveType,
  prepareSource,
  cleanupPreparedSource,
  validateArchiveFile,
  run7za
};
