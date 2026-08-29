module.exports=async function(req,res){
  try{
    const game=String(req.query?.game||'stardewvalley');
    const modId=String(req.query?.modId||'').trim();
    const exactFileId=String(req.query?.fileId||'').trim();
    const contains=String(req.query?.contains||'').trim().toLowerCase();
    if(!modId)return res.status(400).json({ok:false,error:'modId required'});
    const key=process.env.NEXUS_API_KEY;
    if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const headers={APIKEY:key,'User-Agent':'nexus-loader/2.5','Application-Name':'nexus-loader','Application-Version':'2.5'};
    const fr=await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers});
    if(!fr.ok)return res.status(fr.status).json({ok:false,error:`files HTTP ${fr.status}`});
    const fd=await fr.json();
    const files=Array.isArray(fd)?fd:(fd.files||[]);
    const usable=files.filter(f=>f&&f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase()));
    let matches=exactFileId?usable.filter(f=>String(f.file_id)===exactFileId):(contains?usable.filter(f=>String(f.name||'').toLowerCase().includes(contains)):usable);
    matches.sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
    if(!matches.length)return res.status(404).json({ok:false,error:'No matching file',files:usable.map(f=>({file_id:f.file_id,name:f.name,category_name:f.category_name,uploaded_timestamp:f.uploaded_timestamp}))});
    const chosen=matches[0];
    const dr=await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${chosen.file_id}/download_link.json`,{headers});
    if(!dr.ok)return res.status(dr.status).json({ok:false,error:`download_link HTTP ${dr.status}`,chosen});
    const links=await dr.json();
    const url=links[0]?.URI||links[0]?.uri||null;
    return res.json({ok:Boolean(url),chosen:{file_id:chosen.file_id,name:chosen.name,category_name:chosen.category_name,size_kb:chosen.size_kb,uploaded_timestamp:chosen.uploaded_timestamp},url});
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
};
