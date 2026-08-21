const AdmZip=require('adm-zip');
const UPDATES=[
{id:7482,fid:175111,installed:'4.0.0',latest:'4.1.0',name:'Better Signs'},
{id:14916,fid:178009,installed:'1.0.8',latest:'1.1.3',name:'Dwarf Portrait Replacement'},
{id:16491,fid:74411,installed:'1.0.2',latest:'1.0.3',name:'Simple Weapons'},
{id:18914,fid:176020,installed:'1.4.0',latest:'2.0.0',name:'Crop Growth Adjustments'},
{id:21588,fid:176516,installed:'1.1.0',latest:'1.2.0',name:'Custom Backpack Framework'},
{id:22016,fid:93132,installed:'1.0.2',latest:'1.0.3',name:'Winter Gifts'},
{id:23697,fid:176450,installed:'2.2.1',latest:'2.2.2',name:'Mastery Extended'},
{id:25328,fid:177076,installed:'1.9.10',latest:'1.9.14',name:'Extra Animal Configs'},
{id:26236,fid:110396,installed:'1.0.7',latest:'1.0.8',name:'Sweet Gem Berry Extended - English Translation'},
{id:28103,fid:171098,installed:'1.5.0',latest:'1.7.0',name:'Luck Skill'},
{id:29400,fid:177667,installed:'1.3.0',latest:'1.3.1',name:'A Warm Welcome'},
{id:32081,fid:178840,installed:'1.0.1',latest:'1.1.0',name:'BlinkFix'},
{id:39979,fid:179311,installed:'1.0.4',latest:'1.0.5',name:'Billboard Beautifier'},
{id:44845,fid:178219,installed:'1.4.4',latest:'1.5',name:'Evelyn Expansion'}
];
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'GET/POST required'});
 const key=process.env.NEXUS_API_KEY;if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY is not configured'});
 const b=req.method==='GET'?(req.query||{}):(req.body||{}),game=String(b.game||'stardewvalley').replace(/[^a-z0-9_-]/gi,''),headers={apikey:key,'User-Agent':'nexus-loader/2.3'};
 const json=async u=>{const r=await fetch(u,{headers});let d=null;try{d=await r.json()}catch{}if(!r.ok){const e=Error('Nexus request failed');e.status=r.status;throw e}return d};
 const pint=v=>{const n=Number(v);return Number.isInteger(n)&&n>0?n:null};
 const main=files=>{const a=(Array.isArray(files)?files:[]).filter(f=>(f.category_name==='MAIN'||f.category_id===1)&&!/android/i.test(`${f.name||''} ${f.file_name||''} ${f.description||''}`));return a.find(f=>f.is_primary)||a.sort((x,y)=>(y.uploaded_timestamp||0)-(x.uploaded_timestamp||0))[0]||null};
 const one=async id=>{try{const[m,p]=await Promise.all([json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}.json`),json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)]),f=main(p.files);if(!f)return{id,ok:false,error:'No MAIN file'};return{id,ok:true,name:m.name,modVersion:m.version,fileId:f.file_id,fileName:f.file_name,fileVersion:f.version||f.mod_version||null,sizeBytes:f.size_in_bytes||null,uploaded:f.uploaded_timestamp||null}}catch(e){return{id,ok:false,status:e.status||500}}};
 const premium=async()=>{const u=await json('https://api.nexusmods.com/v1/users/validate.json');if(!u||!u.is_premium){const e=Error('Nexus Premium required');e.status=403;throw e}};
 const mirror=async(id,fid)=>{const ls=await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files/${fid}/download_link.json`),x=(ls||[]).find(v=>v&&(v.URI||v.uri));if(!x){const e=Error('No mirror');e.status=502;throw e}return x.URI||x.uri};
 const fetchBuf=async u=>{const r=await fetch(u,{redirect:'follow'});if(!r.ok){const e=Error('Mirror download failed');e.status=502;throw e}return Buffer.from(await r.arrayBuffer())};
 const zipText=buf=>{const z=new AdmZip(buf),out=[];for(const e of z.getEntries()){if(e.isDirectory)continue;const n=e.entryName,low=n.toLowerCase();if(/manifest\.json$/.test(low)||/i18n\/(default|ru)\.json$/.test(low)||/assets\/translations\/ru\.json$/.test(low)){let text='';try{text=e.getData().toString('utf8')}catch{}out.push({path:n,bytes:e.header.size,text})}}return out};
 const inspectText=buf=>{const z=new AdmZip(buf),out=[];let total=0;const ex=/\.(json|jsonc|txt|md|xml|tmx|yaml|yml|csv|ini|cfg|config|toml|properties)$/i;for(const e of z.getEntries()){if(e.isDirectory)continue;const n=e.entryName;if(!ex.test(n))continue;const sz=e.header.size||0;if(sz>160000)continue;let text='';try{text=e.getData().toString('utf8').replace(/^\uFEFF/,'')}catch{continue}if(total+text.length>750000){const left=750000-total;if(left<=0)break;text=text.slice(0,left)}total+=text.length;out.push({path:n,bytes:sz,text});if(total>=750000)break}return{files:out,totalChars:total,archiveEntries:z.getEntries().length}};
 try{
  if(b.action==='validate'){const d=await json('https://api.nexusmods.com/v1/users/validate.json');return res.json({ok:true,data:{valid:true,isPremium:!!d?.is_premium}})}
  if(b.action==='files'){const id=pint(b.modId);if(!id)return res.status(400).json({ok:false,error:'Invalid modId'});return res.json({ok:true,data:await json(`https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`)})}
  if(req.method==='GET'&&b.action==='auditCsv'){const pairs=String(b.pairs||'').split(',').map(s=>{const i=s.indexOf(':');return i>0?{id:pint(s.slice(0,i)),installed:s.slice(i+1)}:null}).filter(x=>x&&x.id);if(!pairs.length||pairs.length>100)return res.status(400).json({ok:false,error:'Provide 1-100 id:version pairs'});const rs=await Promise.all(pairs.map(x=>one(x.id))),out=[];for(let i=0;i<rs.length;i++){const r=rs[i],installed=pairs[i].installed;if(!r.ok){out.push({...r,installed});continue}const latest=String(r.fileVersion||r.modVersion||'');if(latest&&latest!==String(installed))out.push({...r,installed,latest,downloadPath:`/api/nexus?action=download&modId=${r.id}&fileId=${r.fileId}&game=${game}`})}return res.json({ok:true,data:{checked:pairs.length,outdated:out.length,items:out}})}
  if(req.method==='GET'&&b.action==='updatesAudit'){await premium();const items=[];for(const u of UPDATES){try{const buf=await fetchBuf(await mirror(u.id,u.fid));items.push({...u,ok:true,bytes:buf.length,textFiles:zipText(buf)})}catch(e){items.push({...u,ok:false,error:e.message})}}return res.json({ok:true,data:{count:UPDATES.length,items}})}
  if(req.method==='GET'&&b.action==='inspectUpdate'){const id=pint(b.modId),u=UPDATES.find(x=>x.id===id);if(!u)return res.status(404).json({ok:false,error:'modId is not in verified update batch'});await premium();const buf=await fetchBuf(await mirror(u.id,u.fid));return res.json({ok:true,data:{update:u,archiveBytes:buf.length,...inspectText(buf)}})}
  if(req.method==='GET'&&b.action==='updatesBundle'){await premium();const out=new AdmZip();const report=[];for(const u of UPDATES){const buf=await fetchBuf(await mirror(u.id,u.fid));const fn=`${String(u.name).replace(/[^a-z0-9._ -]/gi,'_')} ${u.latest}.zip`;out.addFile(fn,buf);report.push({...u,file:fn,bytes:buf.length})}out.addFile('UPDATED_MODS_REPORT.json',Buffer.from(JSON.stringify(report,null,2)));res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="UPDATED_MODS_14_VERIFIED.zip"');return res.send(out.toBuffer())}
  if(req.method==='GET'&&b.action==='resolveQueueCsv'){const ids=[...new Set(String(b.ids||'').split(',').map(pint).filter(Boolean))];if(!ids.length||ids.length>100)return res.status(400).json({ok:false,error:'Provide 1-100 ids'});return res.json({ok:true,data:{items:await Promise.all(ids.map(one))}})}
  if(req.method==='GET'&&b.action==='download'){const id=pint(b.modId),fid=pint(b.fileId);if(!id||!fid)return res.status(400).json({ok:false,error:'Invalid modId/fileId'});await premium();res.setHeader('Location',await mirror(id,fid));return res.status(302).end()}
  if(req.method==='GET'&&b.action==='proxyDownload'){const id=pint(b.modId),fid=pint(b.fileId);if(!id||!fid)return res.status(400).json({ok:false,error:'Invalid modId/fileId'});await premium();const buf=await fetchBuf(await mirror(id,fid));if(buf.length>3500000)return res.status(413).json({ok:false,error:'File too large for proxyDownload',sizeBytes:buf.length});res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="nexus-${id}-${fid}"`);return res.send(buf)}
  return res.status(400).json({ok:false,error:'Unknown action'})
 }catch(e){return res.status(e.status||500).json({ok:false,error:e.message||'Nexus request failed',status:e.status||500})}
};
