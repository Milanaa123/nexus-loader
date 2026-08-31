module.exports=async function(req,res){
 try{
  const game=String(req.query?.game||'stardewvalley');
  const modId=String(req.query?.modId||'').trim();
  if(!modId)return res.status(400).json({ok:false,error:'modId required'});
  const key=process.env.NEXUS_API_KEY;
  const headers={APIKEY:key,'User-Agent':'nexus-loader/2.6','Application-Name':'nexus-loader','Application-Version':'2.6'};
  const r=await fetch(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers});
  const j=await r.json();
  const files=(j.files||j||[]).map(f=>({file_id:f.file_id,name:f.name,version:f.version,category_name:f.category_name,size_kb:f.size_kb,size_in_bytes:f.size_in_bytes,uploaded_time:f.uploaded_time,content_preview_link:f.content_preview_link}));
  return res.status(r.status).json({ok:r.ok,files});
 }catch(e){return res.status(500).json({ok:false,error:e.message});}
};
