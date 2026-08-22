const fs = require('fs');
const path = require('path');

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function nexusSearch(name){
  const key = process.env.NEXUS_API_KEY;
  if(!key) return null;
  const url = `https://api.nexusmods.com/v1/games/stardewvalley/mods.json?query=${encodeURIComponent(name)}`;
  try{
    const r = await fetch(url,{headers:{apikey:key}});
    if(!r.ok) return null;
    const data = await r.json();
    const first = Array.isArray(data) ? data[0] : null;
    return first ? first.mod_id : null;
  }catch(e){ return null; }
}

module.exports = async function(req,res){
 const input = path.join(__dirname,'..','mods_full_list.txt');
 const out = path.join(__dirname,'..','RU_PACK_WORK','mods_with_ids.json');
 if(!fs.existsSync(input)) return res.status(404).json({ok:false,error:'mods_full_list.txt not found'});
 const lines = fs.readFileSync(input,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const result=[];
 let found=0;
 for(const name of lines){
   const modId = await nexusSearch(name);
   if(modId) found++;
   result.push({name,modId,status:modId?'found':'not_found'});
   await sleep(250);
 }
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2),'utf8');
 return res.json({ok:true,total:result.length,found,file:'RU_PACK_WORK/mods_with_ids.json',status:'completed'});
};
