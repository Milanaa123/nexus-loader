const fs=require('fs');
const path=require('path');
const https=require('https');

const root=path.join(__dirname,'..');
const state=path.join(root,'ru-status.json');
const out=path.join(root,'RU_PACK_WORK','translations.json');

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function get(url,headers={}){return new Promise(resolve=>https.get(url,{headers},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{resolve(JSON.parse(d))}catch{resolve({})}})}).on('error',()=>resolve({})));}
function mods(){const f=path.join(root,'моды(3).txt');if(!fs.existsSync(f))return [];const a=fs.readFileSync(f,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let r=[];for(let i=0;i<a.length;i+=2)r.push({name:a[i],author:a[i+1]||''});return r;}
async function find(mod){const key=process.env.NEXUS_API_KEY;if(!key)return null;const q=encodeURIComponent(mod.name+' '+mod.author+' russian translation');const j=await get('https://api.nexusmods.com/v1/games/stardewvalley/search.json?terms='+q,{apikey:key});const arr=Array.isArray(j)?j:(j.results||[]);return arr.find(x=>/russian|ru|translation|рус/i.test((x.name||'')+' '+(x.summary||'')))||null;}
module.exports=async(req,res)=>{const list=mods();let done=0,found=[],none=[];save(state,{running:true,total:list.length,processed:0,downloaded:0});for(const m of list){try{const t=await find(m);if(t)found.push({...m,modId:t.mod_id,nameRU:t.name});else none.push(m);}catch(e){none.push({...m,error:e.message});}done++;save(state,{running:true,total:list.length,processed:done,foundTranslations:found.length,noTranslations:none.length,current:m.name});}
save(out,{found,none});save(state,{running:false,total:list.length,processed:done,foundTranslations:found.length,noTranslations:none.length});res.json({ok:true,total:list.length,foundTranslations:found.length,noTranslations:none.length});};