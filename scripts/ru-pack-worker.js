const fs=require('fs');
const {paths}=require('../config/paths');
const {downloadMod,ensure}=require('./nexus-downloader');
const {findTranslation}=require('./find-translation');
const {run:importQueue}=require('./import_mod_queue');
const {createPipelineResult,setStatus}=require('../lib/mod-status');
const {buildReadyMod}=require('../lib/build-pipeline');
const state=require('../lib/state-store');

const WORK=paths.workDir;
const PROGRESS=require('path').join(WORK,'progress.json');
const RESULT=require('path').join(WORK,'ru_results.json');
const OUTPUT=paths.outputDir;
const QUEUE=paths.queueFile;

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function save(file,data){fs.mkdirSync(require('path').dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(data,null,2),'utf8');fs.renameSync(tmp,file);}
function saveProgress(data){const value={...data,updatedAt:new Date().toISOString()};save(PROGRESS,value);state.saveProgress(value);}
function addLog(p,t){p.logs=p.logs||[];p.logs.push(new Date().toISOString()+' '+t);if(p.logs.length>300)p.logs=p.logs.slice(-300);}
function loadQueue(){if(!fs.existsSync(QUEUE))importQueue();const q=readJson(QUEUE,{items:[]});return Array.isArray(q)?q:(q.items||q.mods||[]);}

async function processQueue(items){
 if(!items.length){saveProgress({running:false,status:'empty_queue',total:0,processed:0,remaining:0});return;}
 ensure();
 fs.mkdirSync(OUTPUT,{recursive:true});
 let progress=state.getProgress();
 progress={...progress,running:true,status:'processing',total:items.length,logs:progress.logs||[],startedAt:progress.startedAt||new Date().toISOString()};
 let results=readJson(RESULT,[]);
 let processed=state.getProcessed();
 const done=new Set(processed.map(x=>x.modId||x.name));
 saveProgress(progress);

 for(let i=0;i<items.length;i++){
  const mod=items[i];
  const key=mod.modId||mod.name;
  if(done.has(key)) continue;
  const name=mod.name||mod.title||'';const author=mod.author||'';
  const result=createPipelineResult({name,author,modId:mod.modId||null});
  progress.current=name;
  progress.index=i;
  addLog(progress,`Processing ${name} | ${author}`);
  try{
   const translation=await findTranslation({modName:name,author,modId:mod.modId||null});
   if(!translation){setStatus(result,'translation_missing');}
   else{
    result.translationId=translation.translationId;setStatus(result,'translation_found');
    const original=await downloadMod({game:'stardewvalley',modId:mod.modId});
    result.originalPath=original.path;setStatus(result,'original_downloaded');
    const translated=await downloadMod({game:'stardewvalley',modId:result.translationId});
    result.translationPath=translated.path;setStatus(result,'translation_downloaded');
    const built=buildReadyMod({name,originalPath:original.path,translationPath:translated.path,outputDir:OUTPUT});
    result.output=built.output;result.sha256=built.sha256;result.validation=built.validation;setStatus(result,'built');
   }
  }catch(e){
   setStatus(result,'error',e.message);
   state.appendError(e);
  }
  results.push(result);
  processed.push({name,author,modId:mod.modId||null,date:new Date().toISOString(),status:result.status});
  done.add(key);
  state.saveProcessed(processed);
  save(RESULT,results);
  progress.processed=(progress.processed||0)+1;
  progress.remaining=Math.max(0,progress.total-progress.processed);
  saveProgress(progress);
 }
 saveProgress({...progress,running:false,status:'finished',remaining:0,current:null,finishedAt:new Date().toISOString()});
}

async function start(options={}){return processQueue(options.queue&&options.queue.length?options.queue:loadQueue());}
module.exports={start,processQueue};
