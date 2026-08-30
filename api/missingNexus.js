const ALLOWED = {
  coii: { modId: 2869, match: /CP\s*-\s*Coii'?s Hair Sets Pack/i },
  hxw: { modId: 9991, match: /Bakery|Cafe|Furniture/i },
  anything: { modId: 21233, match: /Anything Anywhere/i },
};

async function nexusJson(url, key) {
  const r = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader/2.5' } });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Nexus ${r.status}`);
  return d;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) return res.status(500).json({ ok: false, error: 'NEXUS_API_KEY missing' });
    const which = String(req.query.which || '').toLowerCase();
    const spec = ALLOWED[which];
    if (!spec) return res.status(400).json({ ok: false, error: 'Unknown whitelist key' });

    const pack = await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${spec.modId}/files.json`, key);
    const files = (pack && pack.files) || [];
    let candidates = files.filter(f => (f.category_name === 'MAIN' || f.category_id === 1) && spec.match.test(String(f.name || '') + ' ' + String(f.file_name || '')));
    if (!candidates.length) candidates = files.filter(f => f.category_name === 'MAIN' || f.category_id === 1);
    const chosen = candidates.sort((a,b) => (b.uploaded_timestamp || 0) - (a.uploaded_timestamp || 0))[0];
    if (!chosen) throw new Error('No main file found');

    const links = await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${spec.modId}/files/${chosen.file_id}/download_link.json`, key);
    const mirror = Array.isArray(links) && links.find(x => x && (x.URI || x.uri));
    if (!mirror) throw new Error('Download mirror missing');
    const rr = await fetch(mirror.URI || mirror.uri, { redirect: 'follow' });
    if (!rr.ok) throw new Error(`Mirror ${rr.status}`);
    const buf = Buffer.from(await rr.arrayBuffer());
    const name = String(chosen.file_name || chosen.name || `${which}.zip`).replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('X-Nexus-Mod-Id', String(spec.modId));
    res.setHeader('X-Nexus-File-Id', String(chosen.file_id));
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
