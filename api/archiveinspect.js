const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { path7za } = require('7zip-bin');

const TEXT_EXT = new Set(['.json','.jsonc','.txt','.md','.xml','.tmx','.yaml','.yml','.csv','.ini','.cfg','.config','.toml','.properties','.xnb.txt']);

function walk(root, dir = root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(root, p, out);
    else {
      const rel = path.relative(root, p).split(path.sep).join('/');
      out.push({ name: rel, full: p, size: fs.statSync(p).size });
    }
  }
  return out;
}

async function nx(url, key) {
  const r = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader-archiveinspect/1.0' } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Nexus ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function nexusBuffer(game, modId, fileId, key) {
  const links = await nx(`https://api.nexusmods.com/v1/games/${encodeURIComponent(game)}/mods/${modId}/files/${fileId}/download_link.json`, key);
  const mirror = (links || []).find(x => x && (x.URI || x.uri));
  if (!mirror) throw new Error(`No Nexus mirror for ${modId}/${fileId}`);
  const r = await fetch(mirror.URI || mirror.uri, { redirect: 'follow' });
  if (!r.ok) throw new Error(`Mirror ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function looksText(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.xnb.txt')) return true;
  return TEXT_EXT.has(path.extname(lower));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let tmp = null;
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'GET only' });
    const key = process.env.NEXUS_API_KEY;
    if (!key) throw new Error('NEXUS_API_KEY missing');
    const game = String(req.query.game || 'stardewvalley');
    const modId = Number(req.query.modId);
    const fileId = Number(req.query.fileId);
    if (!Number.isInteger(modId) || !Number.isInteger(fileId)) return res.status(400).json({ ok:false, error:'modId and fileId required' });
    const maxFileBytes = Math.min(Math.max(Number(req.query.maxFileBytes || 120000), 1000), 500000);
    const maxTotalChars = Math.min(Math.max(Number(req.query.maxTotalChars || 700000), 10000), 1500000);
    let re = null;
    if (req.query.pathRegex) {
      try { re = new RegExp(String(req.query.pathRegex), 'i'); }
      catch { return res.status(400).json({ ok:false, error:'invalid pathRegex' }); }
    }

    const buf = await nexusBuffer(game, modId, fileId, key);
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nxinspect-'));
    const arc = path.join(tmp, 'source.arc');
    const out = path.join(tmp, 'out');
    fs.mkdirSync(out);
    fs.writeFileSync(arc, buf);
    try {
      execFileSync(path7za, ['x', arc, `-o${out}`, '-y'], { stdio:'pipe', timeout:60000 });
    } catch (e) {
      const stderr = e && e.stderr ? String(e.stderr).slice(0,2000) : '';
      throw new Error(`7zip extraction failed ${stderr}`);
    }

    const all = walk(out);
    const candidates = all.filter(f => looksText(f.name) && (!re || re.test(f.name)));
    let used = 0;
    const files = [];
    for (const f of candidates) {
      if (used >= maxTotalChars) break;
      const b = fs.readFileSync(f.full);
      const limited = b.subarray(0, Math.min(b.length, maxFileBytes));
      let text = limited.toString('utf8').replace(/^\uFEFF/, '');
      const left = maxTotalChars - used;
      if (text.length > left) text = text.slice(0, left);
      used += text.length;
      files.push({ name:f.name, size:f.size, truncated:f.size > limited.length || text.length < limited.toString('utf8').replace(/^\uFEFF/,'').length, text });
    }

    return res.json({
      ok:true,
      game, modId, fileId,
      archiveBytes:buf.length,
      archiveFileCount:all.length,
      textCandidateCount:candidates.length,
      returnedFileCount:files.length,
      totalChars:used,
      files
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e && e.message || e) });
  } finally {
    if (tmp) try { fs.rmSync(tmp, { recursive:true, force:true }); } catch {}
  }
};
