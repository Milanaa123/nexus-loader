const fs = require('fs');
const path = require('path');

const workDir = path.join(__dirname,'..','RU_PACK_WORK');
const stateFile = path.join(workDir,'generator_status.json');
const outFile = path.join(workDir,'mods_with_ids.json');

function saveState(data){
 fs.mkdirSync(workDir,{recursive:true});
 fs.writeFileSync(stateFile,JSON.stringify(data,null,2),'utf8');
}

async function nexusSearch(name){
 const key = process.env.NEXUS_API_KEY;
 if(!key) return null;
 try{
  const r = await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods.json?query=${encodeURIComponent(name)}`,{headers:{apikey:key}});
  if(!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data)&&data[0] ? data[0].mod_id : null;
 }catch(e){ return null; }
}

async function run(){
 const input = path.join(__dirname,'..','моды(3).txt');
 const names = fs.readFileSync(input,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 let result=[];
 let start=0;
 if(fs.existsSync(outFile)){
  try{ result=JSON.parse(fs.readFileSync(outFile,'utf8')); start=result.length; }catch(e){}
 }
 let found=result.filter(x=>x.modId).length;
 saveState({running:true,total:names.length,processed:start,found,current:names[start]||null});
 for(let i=start;i<names.length;i++){
  const name=names[i];
  const modId=await nexusSearch(name);
  if(modId) found++;
  result.push({name,modId,status:modId?'found':'not_found'});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2),'utf8');
  saveState({running:true,total:names.length,processed:i+1,found,current:names[i]});
  await new Promise(r=>setTimeout(r,250));
 }
 saveState({running:false,total:names.length,processed:result.length,found,file:outFile});
}

module.exports=async function(req,res){
 const input=path.join(__dirname,'..','моды(3).txt');
 if(!fs.existsSync(input)) return res.status(404).json({ok:false,error:'моды(3).txt not found'});
 const status=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
 if(!status||!status.running) run();
 return res.json({ok:true,status:'started',source:'моды(3).txt'});
};