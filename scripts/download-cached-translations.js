const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const AdmZip=require('adm-zip');
const {downloadMod}=require('./nexus-downloader');

const ROOT=path.join(__dirname,'..');
const CACHE_DIR=path.join(ROOT,'saved-results','cache');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const PROGRESS=path.join(WORK,'progress.json');
const RESULT=path.join(WORK,'ru_results.json');
const ARCHIVE=path.join(WORK,'RU_TRANSLATIONS_107.zip');

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function safeName(s){return String(s||'translation').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'translation';}
function loadCached(){
  const files=[1,2,3,4].map(n=>path.join(CACHE_DIR,`export-${n}.b64`));
  if(!files.every(fs.existsSync))throw new Error('Persistent translation cache is incomplete');
  const b64=files.map(f=>fs.readFileSync(f,'utf8').trim()).join('');
  const payload=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
  const rows=Array.isArray(payload.results)?payload.results:[];
  const seen=new Set();
  return rows.filter(x=>x&&x.translationId&&x.fileId).filter(x=>{
    const k=String(x.translationId)+':'+String(x.fileId);
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
}
function buildArchive(results){
  const ok=results.filter(x=>x&&x.status==='downloaded'&&x.path&&fs.existsSync(x.path));
  const zip=new AdmZip();
  const manifest=ok.map((x,i)=>({index:i+1,name:x.name||null,modId:x.modId||null,translationId:x.translationId||null,fileId:x.fileId||null,size:x.size||null,sourceFileName:x.fileName||null}));
  ok.forEach((x,i)=>{
    const ext=path.extname(x.path)||'.zip';
    const entry=`${String(i+1).padStart(3,'0')}_${safeName(x.name)}_T${x.translationId}_F${x.fileId}${ext}`;
    zip.addLocalFile(x.path,'',entry);
  });
  zip.addFile('manifest.json',Buffer.from(JSON.stringify({createdAt:new Date().toISOString(),count:ok.length,files:manifest},null,2),'utf8'));
  fs.mkdirSync(WORK,{recursive:true});
  zip.writeZip(ARCHIVE);
  return {path:ARCHIVE,count:ok.length,size:fs.statSync(ARCHIVE).size};
}

async function run(){
  const items=loadCached();
  console.log(`CACHED RU DOWNLOAD START total=${items.length}`);
  let progress={running:true,status:'downloading_cached_translations',total:items.length,processed:0,remaining:items.length,downloaded:0,failed:0,current:null,archiveReady:false,startedAt:new Date().toISOString(),logs:[]};
  const results=[];
  save(PROGRESS,progress);save(RESULT,results);
  for(let i=0;i<items.length;i++){
    const item=items[i];
    progress.current=item.name||null;
    progress.translationId=String(item.translationId);
    progress.fileId=String(item.fileId);
    const startMsg=`${new Date().toISOString()} START ${item.name||''} translation=${item.translationId} file=${item.fileId}`;
    progress.logs.push(startMsg);
    if(progress.logs.length>300)progress.logs=progress.logs.slice(-300);
    save(PROGRESS,{...progress,updatedAt:new Date().toISOString()});
    try{
      const dl=await downloadMod({game:'stardewvalley',modId:String(item.translationId),fileId:String(item.fileId)});
      results.push({...item,status:'downloaded',path:dl.path,size:dl.size,fileName:dl.fileName||item.fileName||null});
      progress.downloaded++;
      const doneMsg=`CACHED RU DOWNLOAD DONE ${i+1}/${items.length} ${item.name||''} translation=${item.translationId} file=${item.fileId} bytes=${dl.size}`;
      console.log(doneMsg);progress.logs.push(`${new Date().toISOString()} ${doneMsg}`);
    }catch(e){
      results.push({...item,status:'error',error:e.message});
      progress.failed++;
      const errMsg=`CACHED RU DOWNLOAD ERROR ${i+1}/${items.length} ${item.name||''} ${e.message}`;
      console.log(errMsg);progress.logs.push(`${new Date().toISOString()} ${errMsg}`);
    }
    progress.processed=i+1;
    progress.remaining=items.length-progress.processed;
    save(RESULT,results);
    save(PROGRESS,{...progress,updatedAt:new Date().toISOString()});
  }
  const archive=buildArchive(results);
  console.log(`CACHED RU ARCHIVE READY count=${archive.count} bytes=${archive.size} path=${archive.path}`);
  progress.logs.push(`${new Date().toISOString()} ARCHIVE READY count=${archive.count} bytes=${archive.size}`);
  console.log(`CACHED RU DOWNLOAD FINISHED downloaded=${progress.downloaded}/${items.length} failed=${progress.failed}`);
  save(PROGRESS,{...progress,running:false,status:'finished',current:null,translationId:null,fileId:null,remaining:0,archiveReady:true,archivePath:archive.path,archiveSize:archive.size,archiveCount:archive.count,finishedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
}

if(!global.__cachedTranslationDownloadStarted){
  global.__cachedTranslationDownloadStarted=true;
  setImmediate(()=>run().catch(e=>{
    save(PROGRESS,{running:false,status:'error',error:e.message,updatedAt:new Date().toISOString()});
    console.error('CACHED RU DOWNLOAD ERROR',e.stack||e.message);
  }));
}

module.exports={run,loadCached,buildArchive,ARCHIVE};
