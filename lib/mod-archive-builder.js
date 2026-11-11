const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function collectFiles(dir, base = dir, result = []) {
  if (!dir || !fs.existsSync(dir)) return result;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not supported in mod packages: ${full}`);
    if (stat.isDirectory()) collectFiles(full, base, result);
    else if (stat.isFile()) {
      const relative = path.relative(base, full).split(path.sep).join('/');
      if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`Unsafe mod file path: ${full}`);
      result.push({ full, relative });
    }
  }
  return result;
}

function hasManifest(files) {
  return files.some(file => path.posix.basename(file.relative).toLowerCase() === 'manifest.json');
}

function mergeDirectories(sourceDir, translationDir, outputZip, options = {}) {
  const sources = [];
  const merged = new Map();
  let overwritten = 0;

  if (sourceDir && fs.existsSync(sourceDir)) {
    for (const file of collectFiles(sourceDir)) {
      const relative = options.mapOriginalPath ? options.mapOriginalPath(file.relative) : file.relative;
      merged.set(relative, file.full);
    }
    sources.push('original');
  }
  if (translationDir && fs.existsSync(translationDir)) {
    for (const file of collectFiles(translationDir)) {
      const relative = options.mapTranslationPath ? options.mapTranslationPath(file.relative) : file.relative;
      if (!relative || relative.startsWith('/') || relative.split('/').includes('..')) throw new Error('Unsafe translation overlay path');
      if (merged.has(relative)) overwritten += 1;
      merged.set(relative, file.full);
    }
    sources.push('translation');
  }
  if (!sources.length || !merged.size) throw new Error('No files available for archive merge');

  const zip = new AdmZip();
  for (const [relative, full] of [...merged.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    zip.addFile(relative, fs.readFileSync(full));
  }
  ensureDir(path.dirname(outputZip));
  const temporary = outputZip + '.partial-' + crypto.randomUUID();
  try {
    fs.writeFileSync(temporary, zip.toBuffer(), { flag: 'wx', mode: 0o600 });
    fs.linkSync(temporary, outputZip);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const size = fs.statSync(outputZip).size;
  if (size === 0) throw new Error('Created archive is empty');
  return {
    output: outputZip,
    sources,
    fileCount: merged.size,
    overwritten,
    size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(outputZip)).digest('hex')
  };
}

function validateModFolder(dir) {
  const exists = Boolean(dir && fs.existsSync(dir));
  if (!exists) return { exists: false, fileCount: 0, hasManifest: false, valid: false, files: [] };
  try {
    const files = collectFiles(dir);
    return {
      exists: true,
      fileCount: files.length,
      hasManifest: hasManifest(files),
      valid: files.length > 0,
      files: files.map(file => file.relative)
    };
  } catch (error) {
    return { exists: true, fileCount: 0, hasManifest: false, valid: false, files: [], error: error.message };
  }
}

module.exports = { collectFiles, mergeDirectories, validateModFolder };
