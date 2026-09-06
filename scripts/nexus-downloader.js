const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const ROOT=path.join(__dirname,'..');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const DOWNLOADS=path.join(WORK,'downloads');

function ensure(){fs.mkdirSync(DOWNLOADS,{recursive:true});}
function headers(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');return {APIKEY:key,'User-Agent':'nexus-loader/2.0','Application-Name':'nexus-loader','Application-Version':'2.0'};}

async function request(url,options={},retries=3){
 let last;
 for(let i=0;i<retries;i++){
  try{
   const r=await fetch(url,options);
   if(r.ok)return r;
   let body='';try{body=await r.text();}catch{}
   last=new Error(`HTTP ${r.status}${body?`: ${body.slice(0,160)}`:''}`);
  }catch(e){last=e;}
  if(i<retries-1)await new Promise(r=>setTimeout(r,1000*(i+1)));
 }
 throw last||new Error('Request failed');
}

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function isZip(file){return !!file&&fs.existsSync(file)&&fs.statSync(file).size>4&&fs.readFileSync(file).subarray(0,2).toString('hex')==='504b';}

async function chooseFile(game,modId){
 const r=await request(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers:headers()});
 const data=await r.json();const files=Array.isArray(data)?data:(data.files||[]);
 const usable=files.filter(f=>f&&f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase()));
 if(!usable.length)throw new Error(`No downloadable files for mod ${modId}`);
 usable.sort((a,b)=>Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary))||Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
 return usable[0];
}

async function downloadMod({game='stardewvalley',modId,fileId}){
 if(!modId)throw new Error('modId missing');
 ensure();
 const selected=fileId?{file_id:Number(fileId),name:''}:await chooseFile(game,modId);
 const fid=Number(selected.file_id);
 const r=await request(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fid}/download_link.json`,{headers:headers()});
 const links=await r.json();
 const link=links[0]?.URI||links[0]?.uri;
 if(!link)throw new Error(`No download link for mod ${modId} file ${fid}`);
 const data=await request(link,{},3);
 const buffer=Buffer.from(await data.arrayBuffer());
 const file=path.join(DOWNLOADS,`${modId}-${fid}.zip`);
 fs.writeFileSync(file,buffer);
 if(!isZip(file))throw new Error(`Downloaded file is not a valid zip: ${file}`);
 return {path:file,modId:String(modId),fileId:String(fid),size:buffer.length,sha256:sha256(file)};
}

module.exports={downloadMod,ensure,chooseFile};
