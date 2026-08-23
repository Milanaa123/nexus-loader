const fs=require('fs');
const path=require('path');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
const errFile=path.join(workDir,'mods_errors.json');
function saveState(x){fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(stateFile,JSON.stringify(x,null,2),'utf8');}
function variants(n){return [...new Set([n,n.replace(/\([^)]*\)/g,'').trim(),n.replace(/[._-]/g,' ').replace(/\s+/g,' ').trim()])];}
async function nexusSearch(name){
 const key=process.env.NEXUS_API_KEY;
 if(!key) throw new Error('NEXUS_API_KEY missing');
 const query=`query($filter:String!){mods(filter:$filter,first:10){nodes{id name}}}`;
 for(const q of variants(name)){
  const r=await fetch('https://graphql.nexusmods.com/',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:q}})});
  const text=await r.text();
  if(!r.ok) throw new Error(`GraphQL ${r.status}: ${text.slice(0,200)}`);
  let json;
  try{json=JSON.parse(text)}catch(e){continue;}
  if(json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0,200)}`);
  const items=json.data?.mods?.nodes||[];
  const exact=items.find(x=>(x.name||'').toLowerCase()===name.toLowerCase());
  if(exact) return String(exact.id);
  if(items[0]) return String(items[0].id);
 }
 return null;
}
function loadInput(){const files=['mods_536_clean_for_nexus_generator.txt','mods_536_clean_for_nexus_generator-1.txt','mods_536_for_nexus_loader.txt'];for(const n of files){const f=path.join(__dirname,'..','input','upload_here',n);if(fs.existsSync(f))return fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}return [];}
async function run(names){let result=[],errors=[],found=0;for(let i=0;i<names.length;i++){let id=null;let error=null;try{id=await nexusSearch(names[i]);}catch(e){error=e.message;errors.push({name:names[i],error});}if(id)found++;result.push({name:names[i],modId:id,status:id?'found':'not_found'});fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(outFile,JSON.stringify(result,null,2));fs.writeFileSync(errFile,JSON.stringify(errors,null,2));saveState({running:true,total:names.length,processed:i+1,found,errors:errors.length,lastError:error,current:names[i],remaining:names.length-i-1});}saveState({running:false,total:names.length,processed:names.length,found,errors:errors.length,file:outFile,errorFile:errFile,remaining:0});}
module.exports=async(req,res)=>{const names=loadInput();if(!names.length)return res.status(404).json({ok:false,error:'mods list not found'});run(names);res.json({ok:true,status:'started',total:names.length});};