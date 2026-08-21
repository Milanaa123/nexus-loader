module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const b=req.body||{}; const q=req.query||{}; const action=b.action||q.action;
  const key=process.env.NEXUS_API_KEY;
  if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY is not configured'});
  const game=String(b.game||q.game||'stardewvalley').replace(/[^a-z0-9_-]/gi,'');
  const headers={apikey:key,'User-Agent':'nexus-loader/5.0'};
  async function api(url){const r=await fetch(url,{headers});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Nexus error');return d;}
  if(action==='validate'){
   const d=await api('https://api.nexusmods.com/v1/users/validate.json');
   return res.json({ok:true,data:{valid:true,isPremium:!!d.is_premium}});
  }
  if(action==='files'){
   const id=Number(b.modId||q.modId);if(!id)return res.status(400).json({ok:false,error:'Invalid modId'});
   return res.json({ok:true,data:await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)});
  }
  if(action==='resolveQueue'){
   const ids=Array.isArray(b.modIds)?b.modIds:String(b.modIds||'').split(/[,\s;]+/);
   const items=[];
   for(const v of ids){const id=Number(v);if(!id)continue;try{
    const m=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`);
    const f=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`);
    const file=(f.files||[]).find(x=>x.category_name==='MAIN')||(f.files||[])[0];
    if(!file)throw new Error('No MAIN file');
    items.push({ok:true,id,name:m.name,fileId:file.file_id,fileName:file.file_name,fileVersion:file.version,downloadPath:`/api/nexus?action=download&modId=${id}&fileId=${file.file_id}&game=${game}`});
   }catch(e){items.push({ok:false,modId:id,error:e.message});}}
   return res.json({ok:true,data:{items}});
  }
  if(action==='download'){
   const id=Number(b.modId||q.modId),fid=Number(b.fileId||q.fileId);
   if(!id||!fid)return res.status(400).json({ok:false,error:'Invalid modId/fileId'});
   const d=await api(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files/${fid}/download_link.json`);
   const link=d[0]?.URI||d[0]?.uri;if(!link)return res.status(502).json({ok:false,error:'No mirror'});
   res.writeHead(302,{Location:link});return res.end();
  }
  return res.status(400).json({ok:false,error:'Unknown action',received:action});
 }catch(e){return res.status(500).json({ok:false,error:e.message});}
};