const fs=require('fs');
const path=require('path');
const { start: startRuWorker } = require('../scripts/ru-pack-worker');

const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
let running=false;

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8')}
function log(message){
 let state={};
 try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'))}catch{}
 state.logs=state.logs||[];
 state.logs.push(new Date().toISOString()+' '+message);
 if(state.logs.length>200)state.logs=state.logs.slice(-200);
 save(stateFile,state);
}

function parseInput(){
 const files=[path.join(__dirname,'..','input','mods_for_render_530.csv'),path.join(__dirname,'..','mods_for_render_530.csv'),path.join(__dirname,'..','input','mods_for_render.csv')];
 const file=files.find(f=>fs.existsSync(f));
 if(!file)return [];
 return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(l=>{const p=l.split(',');return{name:(p[0]||'').trim(),author:(p[1]||'').trim(),category:(p[2]||'').trim()}}).filter(x=>x.name);
}

async function search(mod){
 const key=process.env.NEXUS_API_KEY;
 if(!key)throw Error('NEXUS_API_KEY missing');
 const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query:'query($filter: ModsFilter!){mods(filter:$filter,first:20){nodes{id name author{name}}}}',variables:{filter:{name:mod.name}}})});
 const j=await r.json();
 const nodes=j.data?.mods?.nodes||[];
 const n=nodes.find(x=>x.name.toLowerCase()===mod.name.toLowerCase() && (!mod.author || x.author?.name?.toLowerCase()===mod.author.toLowerCase()));
 return n?String(n.id):null;
}

async function run(mods){
 let found=[];
 save(stateFile,{running:true,total:mods.length,processed:0,current:null,status:'id_search',logs:[]});
 log('Начат поиск по названию и автору');
 for(let i=0;i<mods.length;i++){
  const mod=mods[i];
  try{
   log('Поиск: '+mod.name+' | '+mod.author);
   const id=await search(mod);
   if(id){found.push({...mod,modId:id});log('Найден Mod ID: '+id)}
   else log('Mod ID не найден');
  }catch(e){log('Ошибка: '+e.message)}
  save(stateFile,{running:true,total:mods.length,processed:i+1,current:mod.name,status:'id_search',found:found.length,logs:JSON.parse(fs.readFileSync(stateFile,'utf8')).logs});
 }
 save(outFile,found);
 save(stateFile,{running:true,total:found.length,processed:0,current:null,status:'starting_worker',found:found.length,logs:[]});
 log('Передача очереди в RU worker: '+found.length);
 setImmediate(()=>startRuWorker({queue:found}).catch(e=>{log('Worker error: '+e.message);save(stateFile,{running:false,error:e.message})}));
}

module.exports=async(req,res)=>{
 if(running)return res.json({ok:true,status:'already_running'});
 const mods=parseInput();
 if(!mods.length)return res.status(404).json({ok:false,error:'mods file not found'});
 running=true;
 run(mods).finally(()=>running=false);
 res.json({ok:true,status:'started',total:mods.length});
};
