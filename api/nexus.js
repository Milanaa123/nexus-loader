module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'GET/POST required'});
 const key=process.env.NEXUS_API_KEY;if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY is not configured'});
 const b=req.method==='GET'?(req.query||{}):(req.body||{}),game=String(b.game||'stardewvalley').replace(/[^a-z0-9_-]/gi,''),headers={apikey:key,'User-Agent':'nexus-loader/2.1'};
 const json=async u=>{const r=await fetch(u,{headers});let d=null;try{d=await r.json()}catch{}if(!r.ok){const e=Error('Nexus request failed');e.status=r.status;throw e}return d};
 const pint=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
 const main=files=>{const a=(Array.isArray(files)?files:[]).filter(f=>(f.category_name==='MAIN'||f.category_id===1)&&!/android/i.test(`${f.name||''} ${f.file_name||''} ${f.description||''}`));return a.find(f=>f.is_primary)||a.sort((x,y)=>(y.uploaded_timestamp||0)-(x.uploaded_timestamp||0))[0]||null};
 const one=async id=>{try{const[m,p]=await Promise.all([json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`),json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)]),f=main(p.files);if(!f)return{id,ok:false,error:'No MAIN file'};return{id,ok:true,name:m.name,modVersion:m.version,fileId:f.file_id,fileName:f.file_name,fileVersion:f.version||f.mod_version||null,sizeBytes:f.size_in_bytes||null,uploaded:f.uploaded_timestamp||null}}catch(e){return{id,ok:false,status:e.status||500}}};
 const mirror=async(id,fid)=>{const u=await json('https://api.nexusmods.com/v1/users/validate.json');if(!u||!u.is_premium){const e=Error('Nexus Premium required');e.status=403;throw e}const ls=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files/${fid}/download_link.json`),x=(ls||[]).find(v=>v&&(v.URI||v.uri));if(!x){const e=Error('No mirror');e.status=502;throw e}return x.URI||x.uri};
 try{
  if(b.action==='validate'){const d=await json('https://api.nexusmods.com/v1/users/validate.json');return res.json({ok:true,data:{valid:true,isPremium:!!d?.is_premium}})}
  if(b.action==='files'){const id=pint(b.modId);if(!id)return res.status(400).json({ok:false,error:'Invalid modId'});return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)})}
  if(req.method==='GET'&&b.action==='auditCsv'){
   const pairs=String(b.pairs||'').split(',').map(s=>{const i=s.indexOf(':');return i>0?{id:pint(s.slice(0,i)),installed:s.slice(i+1)}:null}).filter(x=>x&&x.id);
   if(!pairs.length||pairs.length>100)return res.status(400).json({ok:false,error:'Provide 1-100 id:version pairs'});
   const rs=await Promise.all(pairs.map(x=>one(x.id))),out=[];
   for(let i=0;i<rs.length;i++){const r=rs[i],installed=pairs[i].installed;if(!r.ok){out.push({...r,installed});continue}const latest=String(r.fileVersion||r.modVersion||'');if(latest&&latest!==String(installed))out.push({...r,installed,latest,downloadPath:`/api/nexus?action=download&modId=${r.id}&fileId=${r.fileId}&game=${game}`})}
   return res.json({ok:true,data:{checked:pairs.length,outdated:out.length,items:out}})
  }
  if(req.method==='GET'&&b.action==='resolveQueueCsv'){const ids=[...new Set(String(b.ids||'').split(',').map(pint).filter(Boolean))];if(!ids.length||ids.length>100)return res.status(400).json({ok:false,error:'Provide 1-100 ids'});return res.json({ok:true,data:{items:await Promise.all(ids.map(one))}})}
  if(req.method==='GET'&&b.action==='download'){const id=pint(b.modId),fid=pint(b.fileId);if(!id||!fid)return res.status(400).json({ok:false,error:'Invalid modId/fileId'});res.setHeader('Location',await mirror(id,fid));return res.status(302).end()}
  if(req.method==='GET'&&b.action==='proxyDownload'){const id=pint(b.modId),fid=pint(b.fileId);if(!id||!fid)return res.status(400).json({ok:false,error:'Invalid modId/fileId'});const r=await fetch(await mirror(id,fid),{redirect:'follow'});if(!r.ok)return res.status(502).json({ok:false,error:'Mirror download failed'});const buf=Buffer.from(await r.arrayBuffer());if(buf.length>3500000)return res.status(413).json({ok:false,error:'File too large for proxyDownload',sizeBytes:buf.length});res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="nexus-${id}-${fid}"`);return res.send(buf)}
  if(req.method==='POST'&&b.action==='resolveQueue'){const ids=[...new Set((b.modIds||[]).map(pint).filter(Boolean))];if(!ids.length||ids.length>100)return res.status(400).json({ok:false,error:'Provide 1-100 ids'});return res.json({ok:true,data:{items:await Promise.all(ids.map(one))}})}
  if(req.method==='POST'&&b.action==='mod'){const id=pint(b.modId);if(!id)return res.status(400).json({ok:false,error:'Invalid modId'});return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`)})}
  return res.status(400).json({ok:false,error:'Unknown action'})
 }catch(e){return res.status(e.status||500).json({ok:false,error:e.message||'Nexus request failed',status:e.status||500})}
};
