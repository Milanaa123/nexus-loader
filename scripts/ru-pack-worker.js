const fs = require('fs');
const path = require('path');
const { downloadMod, ensure } = require('./nexus-downloader');
const { findTranslation } = require('./find-translation');
const { run: importQueue } = require('./import_mod_queue');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const PROGRESS = path.join(WORK, 'progress.json');
const RESULT = path.join(WORK, 'ru_results.json');
const QUEUE = path.join(ROOT, 'data', 'queue', 'ru-pack-queue.json');

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function saveProgress(data){save(PROGRESS,{...data,updatedAt:new Date().toISOString()});}
function addLog(p,t){p.logs=p.logs||[];p.logs.push(new Date().toISOString()+' '+t);if(p.logs.length>200)p.logs=p.logs.slice(-200);}
function loadQueue(){if(!fs.existsSync(QUEUE))importQueue();const q=readJson(QUEUE,{items:[]});return Array.isArray(q)?q:(q.items||q.mods||[]);}

async function processQueue(items){
 if(!items.length){saveProgress({running:false,status:'empty_queue',total:0,processed:0});return;}
 ensure();
 let progress={running:true,status:'processing',total:items.length,processed:0,foundTranslations:0,noTranslations:0,downloaded:0,failed:0,logs:[]};
 let results=[];save(RESULT,results);saveProgress(progress);
 for(let i=0;i<items.length;i++){
  const mod=items[i];const name=mod.name||mod.title||'';const author=mod.author||'';
  const result={name,author,modId:mod.modId||null,translationId:null,status:null};
  progress.current=name;addLog(progress,`Поиск: ${name} | ${author}`);saveProgress(progress);
  try{
   const translation=await findTranslation({modName:name,author,modId:mod.modId||null});
   if(translation){result.translationId=translation.translationId||translation.id||null;progress.foundTranslations++;addLog(progress,`Translation ID: ${result.translationId}`);}else{progress.noTranslations++;result.status='no_translation';addLog(progress,'Перевод не найден');}
   if(result.translationId){const ok=await downloadMod({...mod,modId:result.translationId});if(ok){progress.downloaded++;result.status='downloaded';addLog(progress,'Скачивание завершено');}}
  }catch(e){progress.failed++;result.status='error';result.error=e.message;addLog(progress,`Ошибка: ${e.message}`);}
  results.push(result);save(RESULT,results);progress.processed=i+1;progress.remaining=progress.total-progress.processed;saveProgress(progress);
 }
 saveProgress({...progress,running:false,status:'finished',current:null});
}
async function start(options={}){return processQueue(options.queue&&options.queue.length?options.queue:loadQueue());}
module.exports={start,processQueue};
