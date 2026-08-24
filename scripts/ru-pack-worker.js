const fs=require('fs');
const path=require('path');
const {downloadMod,ensure}=require('./nexus-downloader');
const {findTranslation}=require('./find-translation');
const {run:importQueue}=require('./import_mod_queue');

const ROOT=path.join(__dirname,'..');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const PROGRESS=path.join(WORK,'progress.json');
const RESULT=path.join(WORK,'ru_results.json');
const QUEUE=path.join(ROOT,'data','queue','ru-pack-queue.json');

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function saveProgress(data){save(PROGRESS,{...data,updatedAt:new Date().toISOString()});}
function addLog(p,t){p.logs=p.logs||[];p.logs.push(new Date().toISOString()+' '+t);if(p.logs.length>300)p.logs=p.logs.slice(-300);}
function loadQueue(){if(!fs.existsSync(QUEUE))importQueue();const q=readJson(QUEUE,{items:[]});return Array.isArray(q)?q:(q.items||q.mods||[]);}

async function processQueue(items){
 if(!items.length){saveProgress({running:false,status:'empty_queue',total:0,processed:0,remaining:0});return;}
 ensure();
 let progress={running:true,status:'translation_search',total:items.length,processed:0,remaining:items.length,foundTranslations:0,noTranslations:0,downloaded:0,failed:0,modId:null,translationId:null,logs:[]};
 const results=[];save(RESULT,results);saveProgress(progress);
 for(let i=0;i<items.length;i++){
  const mod=items[i];const name=mod.name||mod.title||'';const author=mod.author||'';
  const result={name,author,modId:mod.modId||null,translationId:null,fileId:null,status:null};
  progress.current=name;progress.modId=mod.modId||null;progress.translationId=null;addLog(progress,`Поиск перевода: ${name} | ${author} | Mod ID ${mod.modId||'-'}`);saveProgress(progress);
  try{
   const translation=await findTranslation({modName:name,author,modId:mod.modId||null});
   if(!translation){progress.noTranslations++;result.status='no_translation';addLog(progress,'Перевод не найден');}
   else{
    result.translationId=translation.translationId;progress.translationId=result.translationId;progress.foundTranslations++;
    addLog(progress,`Найден перевод: ${translation.translationName} | Translation ID ${result.translationId}`);saveProgress(progress);
    progress.status='downloading';saveProgress(progress);
    const downloaded=await downloadMod({game:'stardewvalley',modId:result.translationId});
    result.fileId=downloaded.fileId;result.fileName=downloaded.fileName;result.path=downloaded.path;result.status='downloaded';progress.downloaded++;
    addLog(progress,`Скачано: Translation ID ${result.translationId} | File ID ${downloaded.fileId} | ${downloaded.fileName||''}`);
   }
  }catch(e){progress.failed++;result.status='error';result.error=e.message;addLog(progress,`Ошибка: ${e.message}`);}
  results.push(result);save(RESULT,results);progress.processed=i+1;progress.remaining=progress.total-progress.processed;progress.status='translation_search';saveProgress(progress);
 }
 saveProgress({...progress,running:false,status:'finished',current:null,modId:null,translationId:null,remaining:0});
}

async function start(options={}){return processQueue(options.queue&&options.queue.length?options.queue:loadQueue());}
module.exports={start,processQueue};