const fs=require('fs');
const path=require('path');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
function saveState(x){fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(x,null,2),'utf8');}
function variants(n){return [...new Set([n,n.replace(/\([^)]*\)/g,'').trim(),n.replace(/[._-]/g,' ').replace(/\s+/g,' ').trim()])];}
async function nexusSearch(name){
 const key=process.env.NEXUS_API_KEY;
 if(!key) throw new Error('NEXUS_API_KEY missing');
 for(const q of variants(name)){
  const r=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods.json?query=${encodeURIComponent(q)}`,{headers:{apikey:key,'accept':'application/json'}});
  if(!r.ok) continue;
  const data=await r.json();
  if(Array.isArray(data)&&data.length){
   const exact=data.find(m=>(m.name||'').toLowerCase()===name.toLowerCase());
   return (exact||data[0]).mod_id;
  }
 }
 return null;
}
function loadInput(){
 for(const n of ['mods_536_clean_for_nexus_generator.txt','mods_536_clean_for_nexus_generator-1.txt','mods_536_for_nexus_loader.txt']){
  const f=path.join(__dirname,'..','input','upload_here',n);
  if(fs.existsSync(f)) return fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 }
 return [];
}
async function run(names){
 let result=[],found=0,errors=0;
 for(let i=0;i<names.length;i++){
  let id=null;
  try{id=await nexusSearch(names[i]);}catch(e){errors++;}
  if(id)found++;
  result.push({name:names[i],modId:id,status:id?'found':'not_found'});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2));
  saveState({running:true,total:names.length,processed:i+1,found,errors,current:names[i]});
 }
 saveState({running:false,total:names.length,processed:names.length,found,errors,file:outFile});
}
module.exports=async(req,res)=>{const names=loadInput();if(!names.length)return res.status(404).json({ok:false,error:'mods list not found'});run(names);res.json({ok:true,status:'started',total:names.length});};