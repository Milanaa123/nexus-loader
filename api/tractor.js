module.exports = async function tractor(req, res) {
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const headers = {
      APIKEY:key,
      'User-Agent':'nexus-loader/2.6',
      'Application-Name':'nexus-loader',
      'Application-Version':'2.6'
    };
    const game='stardewvalley', modId='1401';
    const fr = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`, {headers});
    if (!fr.ok) return res.status(fr.status).json({ok:false,error:`files HTTP ${fr.status}`});
    const fd = await fr.json();
    const files = (Array.isArray(fd) ? fd : (fd.files || []))
      .filter(f => f && f.file_id && !['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase()))
      .sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
    const chosen = files.find(f => /^tractor mod/i.test(String(f.name||'')) && /4\.24\.4/.test(String(f.name||''))) || files[0];
    if (!chosen) return res.status(404).json({ok:false,error:'No Tractor Mod file'});
    const lr = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${chosen.file_id}/download_link.json`, {headers});
    if (!lr.ok) return res.status(lr.status).json({ok:false,error:`download_link HTTP ${lr.status}`,chosen});
    const links = await lr.json();
    const url = links[0]?.URI || links[0]?.uri;
    if (!url) return res.status(502).json({ok:false,error:'No download URL',chosen});
    const r = await fetch(url, {redirect:'follow'});
    const bytes = Buffer.from(await r.arrayBuffer());
    const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!r.ok || !isZip) return res.status(502).json({ok:false,error:'Downloaded content is not ZIP',status:r.status,bytes:bytes.length,chosen});
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition',`attachment; filename="${String(chosen.name||'Tractor Mod 4.24.4.zip').replace(/[\r\n\"]/g,'')}"`);
    res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('X-Nexus-File-Id',String(chosen.file_id));
    res.setHeader('Cache-Control','public, max-age=3600');
    return res.send(bytes);
  } catch(e) {
    return res.status(502).json({ok:false,error:e.message});
  }
};
