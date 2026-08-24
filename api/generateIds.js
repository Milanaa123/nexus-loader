const fs=require('fs');
const path=require('path');
const {start:startRuWorker}=require('../scripts/ru-pack-worker');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
let running=false;
const save=(f,d)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(d,null,2),'utf8')};
const log=m=>{let s={};try{s=JSON.parse(fs.readFileSync(stateFile,'utf8'))}catch{};s.logs=s.logs||[];s.logs.push(new Date().toISOString()+' '+m);save(stateFile,s)};
const clean=v=>(v||'').replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9а-яё ]/gi,' ').replace(/\s+/g,' ').trim();
const score=(a,b)=>{let x=norm(a).split(' '),y=norm(b).split(' ');return x.filter(w=>w&&y.includes(w)).length/Math.max(x.length,1)};
async function nexus(url){const r=await fetch(url,{headers:{apikey:process.env.NEXUS_API_KEY,'User-Agent':'nexus-loader'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(JSON.stringify(d).slice(0,180));return d}
async function search(m){
 const game='stardewvalley';
 const variants=[clean(m.name),clean(m.name).replace(/\b(1\.6|CP|AT)\b/gi,'').trim()];
 let candidates=[];
 for(const q of variants){
  try{
   const url=`https://api.nexusmods.com/v1/games/${game}/mods.json?keyword=${encodeURIComponent(q)}`;
   const d=await nexus(url);
   const list=Array.isArray(d)?d:(d.mods||d.results||[]);
   log('NEXUS '+q+' results='+list.length);
   candidates.push(...list);
  }catch(e){log('NEXUS FAIL '+q+' '+e.message)}
 }
 const best=[...new Map(candidates.map(x=>[x.mod_id||x.id,x])).values()].map(x=>({...x,s:score(m.name,x.name||'')})).sort((a,b)=>b.s-a.s)[0];
 if(best&&best.mod_id){log('MATCH '+best.name+' id='+best.mod_id);return String(best.mod_id)}
 return null;
}
function parseInput(){const f=[path.join(__dirname,'..','input','mods_for_render_530.csv'),path.join(__dirname,'..','mods_for_render_530.csv')].find(fs.existsSync);if(!f)return [];return fs.readFileSync(f,'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(l=>{let p=l.split(',');return{name:(p[0]||'').trim(),author:(p[1]||'').trim()}})}
async function run(mods){let found=[];save(stateFile,{running:true,total:mods.length,processed:0,status:'id_search',logs:[]});for(let i=0;i<mods.length;i++){let m=mods[i];log('Поиск: '+clean(m.name)+' | '+m.author);let id=await search(m).catch(e=>{log('Ошибка '+e.message);return null});if(id)found.push({...m,modId:id});save(stateFile,{...JSON.parse(fs.readFileSync(stateFile,'utf8')),processed:i+1,current:m.name,foundTranslations:0})}save(outFile,found);setImmediate(()=>startRuWorker({queue:found}))}
module.exports=async(req,res)=>{if(running)return res.json({ok:true,status:'already_running'});running=true;run(parseInput()).finally(()=>running=false);res.json({ok:true,status:'started',total:parseInput().length})};