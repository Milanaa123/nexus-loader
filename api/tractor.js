module.exports = async function tractor(req, res) {
  const pageUrl = 'https://www.curseforge.com/stardewvalley/mods/tractor-mod/download/7759722/file';
  try {
    const r = await fetch(pageUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36',
        'Accept': 'application/zip,application/octet-stream,*/*'
      }
    });
    const bytes = Buffer.from(await r.arrayBuffer());
    const type = String(r.headers.get('content-type') || 'application/octet-stream');
    const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!r.ok || !isZip) {
      return res.status(502).json({
        ok:false,
        upstreamStatus:r.status,
        contentType:type,
        bytes:bytes.length,
        finalUrl:r.url,
        sample:bytes.subarray(0,120).toString('utf8')
      });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="Tractor Mod 4.24.4.zip"');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(bytes);
  } catch (e) {
    return res.status(502).json({ok:false,error:e.message});
  }
};
