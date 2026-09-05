const fs=require('fs');
const path=require('path');
const {downloadMod,ensure}=require('./nexus-downloader');
const {findTranslation}=require('./find-translation');
const {run:importQueue}=require('./import_mod_queue');
const {createPipelineResult,setStatus}=require('../lib/mod-status');
const {buildModPackage}=require('../lib/build-pipeline');

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
 let progress={running:true,status:'translation_search',total:items.length,processed:0,remaining:items.length,foundTranslations:0,noTranslations:0,downloaded:0,built:0,failed:0,logs:[]};
 const results=[];save(RESULT,results);saveProgress(progress);
 for(let i=0;i<items.length;i++){
  const mod=items[i];const name=mod.name||mod.title||'';const author=mod.author||'';
  const result=createPipelineResult({name,author,modId:mod.modId||null});
  result.translationId=null;
  progress.current=name;
  addLog(progress,`Processing ${name} | ${author}`);
  try{
   const translation=await findTranslation({modName:name,author,modId:mod.modId||null});
   if(!translation){progress.noTranslations++;setStatus(result,'translation_missing');}
   else{
    result.translationId=translation.translationId;
    setStatus(result,'translation_found');
    const original=await downloadMod({game:'stardewvalley',modId:mod.modId});
    result.originalPath=original.path;
    setStatus(result,'original_downloaded');
    const translated=await downloadMod({game:'stardewvalley',modId:result.translationId});
    result.translationPath=translated.path;
    setStatus(result,'translation_downloaded');
    const built=await buildModPackage({name,original:original.path,translation:translated.path});
    result.output=built.output;
    result.sha256=built.sha256;
    setStatus(result,'built');
    progress.built++;
   }
  }catch(e){progress.failed++;setStatus(result,'error',e.message);addLog(progress,`ERROR ${e.message}`);}
  results.push(result);save(RESULT,results);
  progress.processed=i+1;progress.remaining=progress.total-progress.processed;saveProgress(progress);
 }
 saveProgress({...progress,running:false,status:'finished',remaining:0,current:null});
}

async function start(options={}){return processQueue(options.queue&&options.queue.length?options.queue:loadQueue());}
module.exports={start,processQueue};
