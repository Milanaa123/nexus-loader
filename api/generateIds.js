const fs=require('fs');
const path=require('path');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
const notFoundFile=path.join(workDir,'mods_not_found.json');
const errFile=path.join(workDir,'mods_errors.json');
let running=false;
function save(f,x){fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(f,JSON.stringify(x,null,2),'utf8');}
function parseInput(){
 const file=path.join(__dirname,'..','mods_for_render.csv');
 if(!fs.existsSync(file)) return [];
 const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean);
 const mods=[];
 for(let i=1;i<lines.length;i++){
  const parts=lines[i].split(',');
  if(parts[0]) mods.push({name:parts[0].trim(),author:(parts[1]||'').trim(),category:(parts[2]||'').trim()});
 }
 return mods;
}
async function search(mod){
 const key=process.env.NEXUS_API_KEY;if(!key)throw Error('NEXUS_API_KEY missing');
 const query='query($filter: ModsFilter!){mods(filter:$filter,first:10){nodes{id name author{name}}}}';
 const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:{name:mod.name}}})});
 const j=await r.json();
 if(j.errors)throw Error(JSON.stringify(j.errors));
 const n=(j.data?.mods?.nodes||[]).find(x=>x.name.toLowerCase()===mod.name.toLowerCase());
 return n?String(n.id):null;
}
async function worker(mods){
 const found=[],notFound=[],errors=[];
 for(let i=0;i<mods.length;i++){
  try{const id=await search(mods[i]);id?found.push({...mods[i],modId:id}):notFound.push(mods[i]);}
  catch(e){errors.push({mod:mods[i],error:e.message});}
  save(outFile,found);save(notFoundFile,notFound);save(errFile,errors);
  save(stateFile,{running:true,total:mods.length,processed:i+1,found:found.length,notFound:notFound.length,errors:errors.length,current:mods[i].name,remaining:mods.length-i-1});
 }
 save(stateFile,{running:false,total:mods.length,processed:mods.length,found:found.length,notFound:notFound.length,errors:errors.length});
}
module.exports=async(req,res)=>{
 if(running)return res.json({ok:true,status:'already_running'});
 const mods=parseInput();
 if(!mods.length)return res.status(404).json({ok:false,error:'mods_for_render.csv not found'});
 running=true;
 save(stateFile,{running:true,total:mods.length,processed:0,found:0,notFound:0,errors:0});
 worker(mods).catch(e=>{running=false;save(stateFile,{running:false,error:e.message});});
 res.json({ok:true,status:'started',total:mods.length});
};