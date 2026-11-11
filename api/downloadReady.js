const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

module.exports = async function downloadReady(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const requested = String(req.query?.name || '').trim();
  if (!requested) return res.status(400).json({ ok: false, error: 'name_required' });

  const safeName = path.basename(requested);
  if (safeName !== requested || /[\\\\\r\n\0]/.test(requested) || !safeName.toLowerCase().endsWith('.zip')) return res.status(400).json({ ok: false, error: 'invalid_archive_name' });
  const outputDir = path.resolve(paths.outputDir);
  let file = path.resolve(outputDir, safeName);
  const relative = path.relative(outputDir, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return res.status(400).json({ ok: false, error: 'invalid_path' });

  let stat;
  for (const directory of [...new Set([outputDir, paths.legacyOutputDir])]) {
    const candidate = path.resolve(directory, safeName);
    try {
      stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) return res.status(404).json({ ok: false, error: 'archive_not_found' });
      file = candidate;
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!stat) return res.status(404).json({ ok: false, error: 'archive_not_found' });
  if (!stat.isFile() || stat.size <= 0) return res.status(404).json({ ok: false, error: 'archive_not_found' });

  const fallback = safeName.replace(/["\r\n]/g, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file);
  stream.on('error', error => { if (!res.headersSent) res.status(500).json({ ok: false, error: error.message }); else res.destroy(error); });
  stream.pipe(res);
};
