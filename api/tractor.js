module.exports = async function tractor(req, res) {
  try {
    const key = process.env.NEXUS_API_KEY;
    const headers = key ? {
      APIKEY:key,
      'User-Agent':'nexus-loader/2.8',
      'Application-Name':'nexus-loader',
      'Application-Version':'2.8'
    } : {};
    const game='stardewvalley', modId='1401';
    let chosen = null;
    let bytes = null;

    if (key) {
      try {
        const fr = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`, {headers});
        if (fr.ok) {
          const fd = await fr.json();
          const files = (Array.isArray(fd) ? fd : (fd.files || []))
            .filter(f => f && f.file_id && !['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase()))
            .sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
          chosen = files.find(f => /^tractor mod/i.test(String(f.name||'')) && /4\.24\.4/.test(String(f.name||''))) || files[0] || null;
          if (chosen) {
            const lr = await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${chosen.file_id}/download_link.json`, {headers});
            if (lr.ok) {
              const links = await lr.json();
              const url = links[0]?.URI || links[0]?.uri;
              if (url) {
                const r = await fetch(url, {redirect:'follow'});
                const b = Buffer.from(await r.arrayBuffer());
                if (r.ok && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b) bytes = b;
              }
            }
          }
        }
      } catch (_) {}
    }

    if (!bytes) {
      const urls = [
        'https://mediafilez.forgecdn.net/files/7759/722/Tractor%20Mod%204.24.4%204.24.4.zip',
        'https://edge.forgecdn.net/files/7759/722/Tractor%20Mod%204.24.4%204.24.4.zip'
      ];
      const attempts = [];
      for (const cfUrl of urls) {
        try {
          const r = await fetch(cfUrl, {redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/2.8'}});
          const b = Buffer.from(await r.arrayBuffer());
          attempts.push({url:cfUrl,status:r.status,bytes:b.length,finalUrl:r.url,type:r.headers.get('content-type')});
          if (r.ok && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b) { bytes = b; break; }
        } catch(e) { attempts.push({url:cfUrl,error:e.message}); }
      }
      if (!bytes) return res.status(502).json({ok:false,error:'Official CurseForge CDN did not return ZIP',attempts,chosen});
      if (!chosen) chosen = {file_id:160476,name:'Tractor Mod 4.24.4',version:'4.24.4'};
    }

    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition','attachment; filename="Tractor Mod 4.24.4.zip"');
    res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('X-Nexus-File-Id',String(chosen?.file_id||160476));
    res.setHeader('Cache-Control','public, max-age=3600');
    return res.send(bytes);
  } catch(e) {
    return res.status(502).json({ok:false,error:e.message});
  }
};
