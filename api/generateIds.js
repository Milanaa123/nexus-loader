const fs = require('fs');
const path = require('path');

const workDir = path.join(__dirname,'..','RU_PACK_WORK');
const stateFile = path.join(workDir,'generator_status.json');
const outFile = path.join(workDir,'mods_with_ids.json');

function saveState(data){
 fs.mkdirSync(workDir,{recursive:true});
 fs.writeFileSync(stateFile,JSON.stringify(data,null,2),'utf8');
}

function cleanName(name){
 return name.replace(/\s+/g,' ').replace(/[._-]/g,' ').trim();
}

async function nexusSearch(name){
 const key=process.env.NEXUS_API_KEY;
 if(!key) throw new Error('NEXUS_API_KEY missing');
 const queries=[name, cleanName(name)];
 for(const q of queries){
  try{
   const r=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods.json?query=${encodeURIComponent(q)}`,{headers:{apikey:key}});
   if(!r.ok) continue;
   const data=await r.json();
   if(Array.isArray(data)&&data.length){
    const exact=data.find(x=>x.name&&x.name.toLowerCase()===name.toLowerCase());
    return (exact||data[0]).mod_id;
   }
  }catch(e){}
 }
 return null;
}

function loadInput(){
 const files=[
  'mods_536_clean_for_nexus_generator.txt',
  'mods_536_clean_for_nexus_generator-1.txt',
  'mods_536_for_nexus_loader.txt'
 ].map(f=>path.join(__dirname,'..','input','upload_here',f));
 for(const f of files){
  if(fs.existsSync(f)) return fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 }
 return [];
}

async function run(){
 const names=loadInput();
 let result=[]; let found=0;
 saveState({running:true,total:names.length,processed:0,found});
 for(let i=0;i<names.length;i++){
  const name=names[i];
  let modId=null;
  try{modId=await nexusSearch(name);}catch(e){saveState({running:false,error:e.message});return;}
  if(modId)found++;
  result.push({name,modId,status:modId?'found':'not_found'});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2),'utf8');
  saveState({running:true,total:names.length,processed:i+1,found,current:name});
 }
 saveState({running:false,total:names.length,processed:result.length,found,file:outFile});
}

module.exports=async function(req,res){
 const names=loadInput();
 if(!names.length)return res.status(404).json({ok:false,error:'mods list not found'});
 run();
 res.json({ok:true,status:'started',total:names.length});
};