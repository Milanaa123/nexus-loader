module.exports=async function(req,res){
  try{
    const key=process.env.NEXUS_API_KEY;
    if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const headers={APIKEY:key,'User-Agent':'nexus-loader/2.4','Application-Name':'nexus-loader','Application-Version':'2.4'};
    const modId='5509';
    const fr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,{headers});
    if(!fr.ok)return res.status(fr.status).json({ok:false,error:`files HTTP ${fr.status}`});
    const fd=await fr.json();
    const files=Array.isArray(fd)?fd:(fd.files||[]);
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const wanted='stardew valley expanded on russian';
    const candidates=files.filter(f=>f&&f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase())&&norm(f.name).includes(wanted));
    candidates.sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
    const chosen=candidates[0];
    if(!chosen)return res.status(404).json({ok:false,error:'Verified SVE Russian file not found',files:files.map(f=>({file_id:f.file_id,name:f.name,category_name:f.category_name}))});
    const dr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${chosen.file_id}/download_link.json`,{headers});
    if(!dr.ok)return res.status(dr.status).json({ok:false,error:`download_link HTTP ${dr.status}`});
    const links=await dr.json();
    const url=links[0]?.URI||links[0]?.uri;
    if(!url)return res.status(502).json({ok:false,error:'No CDN URL'});
    const rr=await fetch(url);
    if(!rr.ok)return res.status(rr.status).json({ok:false,error:`CDN HTTP ${rr.status}`});
    const name=String(chosen.name||'Stardew Valley Expanded on Russian').replace(/[\\/:*?"<>|]+/g,'_')+'.zip';
    res.statusCode=200;
    res.setHeader('Content-Type',rr.headers.get('content-type')||'application/zip');
    const len=rr.headers.get('content-length');if(len)res.setHeader('Content-Length',len);
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('X-Nexus-Mod-Id',modId);
    res.setHeader('X-Nexus-File-Id',String(chosen.file_id));
    const {Readable}=require('stream');
    Readable.fromWeb(rr.body).pipe(res);
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
};
