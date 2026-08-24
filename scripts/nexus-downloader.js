const fs=require('fs');
const path=require('path');

const ROOT=path.join(__dirname,'..');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const DOWNLOADS=path.join(WORK,'downloads');

function ensure(){fs.mkdirSync(DOWNLOADS,{recursive:true});}
function headers(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');return {APIKEY:key,'User-Agent':'nexus-loader/2.0','Application-Name':'nexus-loader','Application-Version':'2.0'};}
async function request(url,options={},retries=3){let last;for(let i=0;i<retries;i++){try{const r=await fetch(url,options);if(r.ok)return r;let body='';try{body=await r.text();}catch{}last=new Error(`HTTP ${r.status}${body?`: ${body.slice(0,160)}`:''}`);}catch(e){last=e;}if(i<retries-1)await new Promise(r=>setTimeout(r,800*(i+1)));}throw last||new Error('Request failed');}

async function chooseFile(game,modId){
 const r=await request(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files.json`,{headers:headers()});
 const data=await r.json();const files=Array.isArray(data)?data:(data.files||[]);
 const usable=files.filter(f=>f&&f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase()));
 if(!usable.length)throw new Error(`No downloadable files for mod ${modId}`);
 usable.sort((a,b)=>{
  const ap=a.is_primary?1:0,bp=b.is_primary?1:0;if(bp!==ap)return bp-ap;
  const am=String(a.category_name||'').toUpperCase()==='MAIN'?1:0,bm=String(b.category_name||'').toUpperCase()==='MAIN'?1:0;if(bm!==am)return bm-am;
  return Number(b.uploaded_timestamp||b.uploaded_time||0)-Number(a.uploaded_timestamp||a.uploaded_time||0);
 });
 return usable[0];
}

async function downloadMod({game='stardewvalley',modId,fileId}){
 if(!modId)throw new Error('modId missing');ensure();
 const selected=fileId?{file_id:Number(fileId),name:''}:await chooseFile(game,modId);
 const fid=Number(selected.file_id);if(!fid)throw new Error(`No fileId for mod ${modId}`);
 const r=await request(`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fid}/download_link.json`,{headers:headers()});
 const links=await r.json();const link=links[0]?.URI||links[0]?.uri;if(!link)throw new Error(`No download link for mod ${modId} file ${fid}`);
 const data=await request(link,{},2);const buffer=Buffer.from(await data.arrayBuffer());
 const safe=String(selected.name||'translation').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)||'translation';
 const file=path.join(DOWNLOADS,`${modId}-${fid}-${safe}.zip`);fs.writeFileSync(file,buffer);
 return {path:file,modId:String(modId),fileId:String(fid),fileName:selected.name||null,size:buffer.length};
}

module.exports={downloadMod,ensure,chooseFile};