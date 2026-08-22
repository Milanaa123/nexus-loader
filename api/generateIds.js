const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname,'..','RU_PACK_WORK','generator_status.json');

function saveState(data){
 fs.mkdirSync(path.dirname(stateFile),{recursive:true});
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
 const input = path.join(__dirname,'..','input','mods_536_for_nexus_loader.txt');
 const out = path.join(__dirname,'..','RU_PACK_WORK','mods_with_ids.json');
 const lines = fs.readFileSync(input,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const result=[]; let found=0;
 saveState({running:true,total:lines.length,processed:0,found});
 for(const name of lines){
  const modId=await nexusSearch(name);
  if(modId) found++;
  result.push({name,modId,status:modId?'found':'not_found'});
  saveState({running:true,total:lines.length,processed:result.length,found});
  await new Promise(r=>setTimeout(r,250));
 }
 fs.writeFileSync(out,JSON.stringify(result,null,2),'utf8');
 saveState({running:false,total:lines.length,processed:result.length,found,file:out});
}

module.exports=async function(req,res){
 const input=path.join(__dirname,'..','input','mods_536_for_nexus_loader.txt');
 if(!fs.existsSync(input)) return res.status(404).json({ok:false,error:'input/mods_536_for_nexus_loader.txt not found'});
 const status=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
 if(!status||!status.running){ run(); }
 return res.json({ok:true,status:'started',source:'input/mods_536_for_nexus_loader.txt'});
};
