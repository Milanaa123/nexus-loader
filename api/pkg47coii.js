const AdmZip=require('adm-zip');
const crypto=require('crypto');

async function nexusJson(url,key){
  const r=await fetch(url,{headers:{apikey:key,'User-Agent':'nexus-loader/2.4'}});
  const d=await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Nexus ${r.status}`);
  return d;
}

function scanText(path,text){
  const lines=text.split(/\r?\n/);
  const hits=[];
  for(let i=0;i<lines.length;i++){
    const s=lines[i].trim();
    if(!s||!/[A-Za-z]{3,}/.test(s)) continue;
    hits.push({line:i+1,text:s.slice(0,500)});
    if(hits.length>=120) break;
  }
  return {path,bytes:Buffer.byteLength(text),hits};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const key=process.env.NEXUS_API_KEY;
    if(!key) return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const modId=2869;
    const pack=await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,key);
    const files=(pack&&pack.files)||[];
    const cp=files.filter(f=>(f.category_name==='MAIN'||f.category_id===1)&&/CP\s*-\s*Coii'?s Hair Sets Pack/i.test(String(f.name||'')))
      .sort((a,b)=>(b.uploaded_timestamp||0)-(a.uploaded_timestamp||0))[0];
    if(!cp) throw new Error('current CP main file not found');
    const links=await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${cp.file_id}/download_link.json`,key);
    const mirror=Array.isArray(links)&&links.find(x=>x&&(x.URI||x.uri));
    if(!mirror) throw new Error('download mirror missing');
    const rr=await fetch(mirror.URI||mirror.uri,{redirect:'follow'});
    if(!rr.ok) throw new Error(`mirror ${rr.status}`);
    const buf=Buffer.from(await rr.arrayBuffer());
    const zip=new AdmZip(buf);
    const entries=zip.getEntries().filter(e=>!e.isDirectory);
    const listing=entries.map(e=>({path:e.entryName,bytes:e.header.size}));
    const textRows=entries.filter(e=>/\.(json|jsonc|txt|md)$/i.test(e.entryName)).map(e=>scanText(e.entryName,e.getData().toString('utf8')));
    const hasI18n=entries.some(e=>/(^|\/)i18n\//i.test(e.entryName));
    const hasDialogueNamedFiles=entries.some(e=>/(dialogue|mail|event|strings|translation|i18n)/i.test(e.entryName));
    return res.json({
      ok:true,
      modId,
      selected:{fileId:cp.file_id,name:cp.name,fileName:cp.file_name,version:cp.version||cp.mod_version,uploadedTimestamp:cp.uploaded_timestamp,sizeKb:cp.size_kb},
      archiveBytes:buf.length,
      sha256:crypto.createHash('sha256').update(buf).digest('hex'),
      fileCount:entries.length,
      hasI18n,
      hasDialogueNamedFiles,
      files:listing,
      textRows
    });
  }catch(e){
    return res.status(500).json({ok:false,error:String(e&&e.message||e)});
  }
};
