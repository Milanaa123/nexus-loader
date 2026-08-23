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
  const urls=[
   `https://api.nexusmods.com/v1/games/stardewvalley/mods/search.json?query=${encodeURIComponent(q)}`,
   `https://api.nexusmods.com/v1/games/stardewvalley/search.json?query=${encodeURIComponent(q)}`
  ];
  for(const url of urls){
   const r=await fetch(url,{headers:{apikey:key,accept:'application/json'}});
   const text=await r.text();
   let data={};try{data=JSON.parse(text)}catch{}
   if(r.status===404) continue;
   if(!r.ok) throw new Error(`Nexus HTTP ${r.status}: ${text.slice(0,120)}`);
   const items=data.results||data.mods||data;
   if(Array.isArray(items)&&items.length){
    const exact=items.find(m=>(m.name||m.title||'').toLowerCase()===name.toLowerCase());
    const item=exact||items[0];
    return item.mod_id||item.modId||null;
   }
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
 let result=[],found=0,errors=0,lastError=null;
 for(let i=0;i<names.length;i++){
  let id=null;
  try{id=await nexusSearch(names[i]);}catch(e){errors++;lastError=e.message;}
  if(id)found++;
  result.push({name:names[i],modId:id,status:id?'found':'not_found'});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2),'utf8');
  saveState({running:true,total:names.length,processed:i+1,found,errors,lastError,current:names[i]});
 }
 saveState({running:false,total:names.length,processed:names.length,found,errors,lastError,file:outFile,remaining:0});
}
module.exports=async(req,res)=>{const names=loadInput();if(!names.length)return res.status(404).json({ok:false,error:'mods list not found'});run(names);res.json({ok:true,status:'started',total:names.length});};