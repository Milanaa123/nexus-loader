const fs=require('fs');
const path=require('path');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
const notFoundFile=path.join(workDir,'mods_not_found.json');
const ambiguousFile=path.join(workDir,'mods_ambiguous.json');
const errFile=path.join(workDir,'mods_errors.json');
function save(p,x){fs.mkdirSync(workDir,{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2),'utf8');}
function variants(n){return [...new Set([n,n.replace(/\([^)]*\)/g,'').trim(),n.replace(/[._-]/g,' ').replace(/\s+/g,' ').trim()])];}
function parseInput(){
 const files=['mods_536_clean_for_nexus_generator.txt','mods_536_clean_for_nexus_generator-1.txt','mods_536_for_nexus_loader.txt'];
 for(const n of files){const f=path.join(__dirname,'..','input','upload_here',n);if(fs.existsSync(f)){
  const lines=fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(let i=0;i<lines.length;i+=3){if(lines[i]&&lines[i+1])out.push({name:lines[i].replace(/^\([^)]*\)\s*/,'').trim(),author:lines[i+1],category:lines[i+2]||''});}
  return out;
 }}
 return [];
}
async function search(name,author){
 const key=process.env.NEXUS_API_KEY;if(!key)throw Error('NEXUS_API_KEY missing');
 const query=`query($filter: ModsFilter!){mods(filter:$filter,first:20){nodes{id name author{name}}}}`;
 for(const q of variants(name)){
  const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:{name:q}}})});
  const j=await r.json();
  if(j.errors)throw Error(JSON.stringify(j.errors));
  const items=j.data?.mods?.nodes||[];
  const exact=items.find(x=>(x.name||'').toLowerCase()===name.toLowerCase() && (!author || x.author?.name?.toLowerCase()===author.toLowerCase()));
  if(exact)return {id:String(exact.id),status:'found_exact'};
  const byName=items.filter(x=>(x.name||'').toLowerCase()===name.toLowerCase());
  if(byName.length===1)return {id:String(byName[0].id),status:'found_name'};
  if(byName.length>1)return {status:'ambiguous',items:byName};
 }
 return null;
}
module.exports=async(req,res)=>{
 const mods=parseInput();if(!mods.length)return res.status(404).json({ok:false,error:'mods list not found'});
 const found=[],notFound=[],ambiguous=[],errors=[];
 for(let i=0;i<mods.length;i++){
  try{const r=await search(mods[i].name,mods[i].author);if(r?.id)found.push({...mods[i],modId:r.id,status:r.status});else if(r?.status==='ambiguous')ambiguous.push({...mods[i],results:r.items});else notFound.push(mods[i]);}
  catch(e){errors.push({mod:mods[i],error:e.message});}
  save(outFile,found);save(notFoundFile,notFound);save(ambiguousFile,ambiguous);save(errFile,errors);save(stateFile,{running:true,total:mods.length,processed:i+1,found:found.length,notFound:notFound.length,ambiguous:ambiguous.length,errors:errors.length,current:mods[i].name,remaining:mods.length-i-1});
 }
 save(stateFile,{running:false,total:mods.length,processed:mods.length,found:found.length,notFound:notFound.length,ambiguous:ambiguous.length,errors:errors.length});
 res.json({ok:true,status:'started',total:mods.length});
};