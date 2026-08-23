const fs=require('fs');
const path=require('path');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
function saveState(x){fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(x,null,2),'utf8');}
function variants(n){return [...new Set([n,n.replace(/\([^)]*\)/g,'').trim(),n.replace(/[._-]/g,' ').replace(/\s+/g,' ').trim()])];}
async function nexusSearch(name){
 for(const q of variants(name)){
  const r=await fetch(`https://www.nexusmods.com/stardewvalley/mods/searchresults/?gsearch=${encodeURIComponent(q)}&gsearchtype=mods`,{headers:{'User-Agent':'nexus-loader'}});
  if(!r.ok) throw new Error(`Nexus page HTTP ${r.status}`);
  const html=await r.text();
  const ids=[...html.matchAll(/\/mods\/(\d+)/g)].map(x=>Number(x[1]));
  if(ids.length)return ids[0];
 }
 return null;
}
function loadInput(){for(const n of ['mods_536_clean_for_nexus_generator.txt','mods_536_clean_for_nexus_generator-1.txt','mods_536_for_nexus_loader.txt']){const f=path.join(__dirname,'..','input','upload_here',n);if(fs.existsSync(f))return fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}return [];}
async function run(names){let result=[],found=0,errors=0,lastError=null;for(let i=0;i<names.length;i++){let id=null;try{id=await nexusSearch(names[i]);}catch(e){errors++;lastError=e.message;}if(id)found++;result.push({name:names[i],modId:id,status:id?'found':'not_found'});fs.writeFileSync(outFile,JSON.stringify(result,null,2),'utf8');saveState({running:true,total:names.length,processed:i+1,found,errors,lastError,current:names[i],remaining:names.length-i-1});}saveState({running:false,total:names.length,processed:names.length,found,errors,lastError,file:outFile,remaining:0});}
module.exports=async(req,res)=>{const names=loadInput();if(!names.length)return res.status(404).json({ok:false,error:'mods list not found'});run(names);res.json({ok:true,status:'started',total:names.length});};