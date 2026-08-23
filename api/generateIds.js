const fs = require('fs');
const path = require('path');

const workDir = path.join(__dirname,'..','RU_PACK_WORK');
const stateFile = path.join(workDir,'generator_status.json');
const outFile = path.join(workDir,'mods_with_ids.json');

function saveState(data){
 fs.mkdirSync(workDir,{recursive:true});
 fs.writeFileSync(stateFile, JSON.stringify(data,null,2),'utf8');
}

async function nexusSearch(name){
 const key = process.env.NEXUS_API_KEY;
 if(!key) return null;
 try{
  const r = await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods.json?query=${encodeURIComponent(name)}`,{headers:{apikey:key}});
  if(!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data)&&data[0] ? data[0].mod_id : null;
 }catch(e){return null;}
}

function loadInput(){
 const files=[
  path.join(__dirname,'..','моды(3).txt'),
  path.join(__dirname,'..','mods_full_list.txt')
 ];
 for(const f of files){
  if(fs.existsSync(f)){
   const text=fs.readFileSync(f,'utf8');
   const arr=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   if(arr.length>5) return arr;
  }
 }
 return [];
}

async function run(){
 const names=loadInput();
 let result=[];
 let found=0;
 saveState({running:true,total:names.length,processed:0,found});
 for(let i=0;i<names.length;i++){
  const name=names[i];
  const modId=await nexusSearch(name);
  if(modId) found++;
  result.push({name,modId,status:modId?'found':'not_found'});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2),'utf8');
  saveState({running:true,total:names.length,processed:i+1,found,current:name});
 }
 saveState({running:false,total:names.length,processed:result.length,found,file:outFile});
}

module.exports=async function(req,res){
 const names=loadInput();
 if(!names.length) return res.status(404).json({ok:false,error:'mods list not found'});
 run();
 return res.json({ok:true,status:'started',total:names.length});
};