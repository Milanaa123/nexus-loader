const fs=require('fs');
const path=require('path');
const { start: startRuWorker } = require('../scripts/ru-pack-worker');

const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
let running=false;

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8')}

function parseInput(){
 const files=[path.join(__dirname,'..','input','mods_for_render_530.csv'),path.join(__dirname,'..','mods_for_render_530.csv'),path.join(__dirname,'..','input','mods_for_render.csv')];
 const file=files.find(f=>fs.existsSync(f));
 if(!file)return [];
 return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(l=>{const p=l.split(',');return{name:(p[0]||'').trim(),author:(p[1]||'').trim(),category:(p[2]||'').trim()}}).filter(x=>x.name);
}

async function search(mod){
 const key=process.env.NEXUS_API_KEY;
 if(!key)throw Error('NEXUS_API_KEY missing');
 const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query:'query($filter: ModsFilter!){mods(filter:$filter,first:10){nodes{id name}}}',variables:{filter:{name:mod.name}}})});
 const j=await r.json();
 const n=(j.data?.mods?.nodes||[]).find(x=>x.name.toLowerCase()===mod.name.toLowerCase());
 return n?String(n.id):null;
}

async function run(mods){
 let found=[];
 save(stateFile,{running:true,total:mods.length,processed:0,current:null,status:'id_search'});
 for(let i=0;i<mods.length;i++){
  try{const id=await search(mods[i]);if(id)found.push({...mods[i],modId:id});}
  catch(e){console.log(e.message)}
  save(stateFile,{running:true,total:mods.length,processed:i+1,current:mods[i].name,status:'id_search'});
 }
 save(outFile,found);
 save(stateFile,{running:true,total:found.length,processed:0,current:null,status:'starting_worker'});
 setImmediate(()=>startRuWorker({queue:found}).catch(e=>save(stateFile,{running:false,error:e.message})));
}

module.exports=async(req,res)=>{
 if(running)return res.json({ok:true,status:'already_running'});
 const mods=parseInput();
 if(!mods.length)return res.status(404).json({ok:false,error:'mods file not found'});
 running=true;
 run(mods).finally(()=>running=false);
 res.json({ok:true,status:'started',total:mods.length});
};
