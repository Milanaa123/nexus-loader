const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const {downloadMod}=require('./nexus-downloader');

const ROOT=path.join(__dirname,'..');
const CACHE_DIR=path.join(ROOT,'saved-results','cache');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const PROGRESS=path.join(WORK,'progress.json');
const RESULT=path.join(WORK,'ru_results.json');

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
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

async function run(){
  const items=loadCached();
  let progress={running:true,status:'downloading_cached_translations',total:items.length,processed:0,remaining:items.length,downloaded:0,failed:0,current:null,startedAt:new Date().toISOString(),logs:[]};
  const results=[];
  save(PROGRESS,progress);save(RESULT,results);
  for(let i=0;i<items.length;i++){
    const item=items[i];
    progress.current=item.name||null;
    progress.translationId=String(item.translationId);
    progress.fileId=String(item.fileId);
    progress.logs.push(`${new Date().toISOString()} START ${item.name||''} translation=${item.translationId} file=${item.fileId}`);
    if(progress.logs.length>300)progress.logs=progress.logs.slice(-300);
    save(PROGRESS,{...progress,updatedAt:new Date().toISOString()});
    try{
      const dl=await downloadMod({game:'stardewvalley',modId:String(item.translationId),fileId:String(item.fileId)});
      results.push({...item,status:'downloaded',path:dl.path,size:dl.size,fileName:dl.fileName||item.fileName||null});
      progress.downloaded++;
      progress.logs.push(`${new Date().toISOString()} DONE ${item.name||''} ${dl.size} bytes`);
    }catch(e){
      results.push({...item,status:'error',error:e.message});
      progress.failed++;
      progress.logs.push(`${new Date().toISOString()} ERROR ${item.name||''} ${e.message}`);
    }
    progress.processed=i+1;
    progress.remaining=items.length-progress.processed;
    save(RESULT,results);
    save(PROGRESS,{...progress,updatedAt:new Date().toISOString()});
  }
  save(PROGRESS,{...progress,running:false,status:'finished',current:null,translationId:null,fileId:null,remaining:0,finishedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
}

if(!global.__cachedTranslationDownloadStarted){
  global.__cachedTranslationDownloadStarted=true;
  setImmediate(()=>run().catch(e=>{
    save(PROGRESS,{running:false,status:'error',error:e.message,updatedAt:new Date().toISOString()});
    console.error('CACHED RU DOWNLOAD ERROR',e.stack||e.message);
  }));
}

module.exports={run,loadCached};
