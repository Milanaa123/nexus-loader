module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const key=process.env.NEXUS_API_KEY;
  if(!key) return res.status(500).json({ok:false,error:'NEXUS_API_KEY is not configured'});
  const body=req.body||{};
  const q=req.query||{};
  const action=body.action||q.action;
  const game=String(body.game||q.game||'stardewvalley');
  const headers={apikey:key,'User-Agent':'nexus-loader/3.0'};
  const api=async u=>{const r=await fetch(u,{headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||'Nexus error'),{status:r.status});return d};
  if(action==='validate'){
   const d=await api('https://api.nexusmods.com/v1/users/validate.json');
   return res.json({ok:true,data:{valid:true,isPremium:!!d.is_premium}});
  }
  if(action==='files'){
   const id=Number(body.modId||q.modId);
   return res.json({ok:true,data:await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)});
  }
  if(action==='resolveQueue'){
   const ids=(body.modIds||[]).map(Number).filter(Boolean);
   const items=[];
   for(const id of ids){
    try{
     const m=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`);
     const f=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`);
     const file=(f.files||[]).find(x=>x.category_name==='MAIN')||(f.files||[])[0];
     items.push({ok:true,id,name:m.name,fileId:file.file_id,fileName:file.file_name,fileVersion:file.version,downloadPath:`/api/nexus?action=download&modId=${id}&fileId=${file.file_id}&game=${game}`});
    }catch(e){items.push({ok:false,modId:id,error:e.message});}
   }
   return res.json({ok:true,data:{items}});
  }
  if(action==='download'){
   const id=Number(body.modId||q.modId),fid=Number(body.fileId||q.fileId);
   const d=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files/${fid}/download_link.json`);
   const link=d[0]?.URI||d[0]?.uri;
   if(!link)return res.status(502).json({ok:false,error:'No download link'});
   res.statusCode=302;res.setHeader('Location',link);return res.end();
  }
  return res.status(400).json({ok:false,error:'Unknown action',received:action||null,body});
 }catch(e){return res.status(e.status||500).json({ok:false,error:e.message});}
};