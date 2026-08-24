const fs=require('fs');
const path=require('path');
const { start:startRuWorker }=require('../scripts/ru-pack-worker');
const workDir=path.join(__dirname,'..','RU_PACK_WORK');
const stateFile=path.join(workDir,'generator_status.json');
const outFile=path.join(workDir,'mods_with_ids.json');
let running=false;
function save(f,d){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(d,null,2),'utf8')}
function log(m){let s={};try{s=JSON.parse(fs.readFileSync(stateFile,'utf8'))}catch{};s.logs=s.logs||[];s.logs.push(new Date().toISOString()+' '+m);if(s.logs.length>300)s.logs=s.logs.slice(-300);save(stateFile,s)}
function cleanName(v){return (v||'').replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim()}
function words(v){return cleanName(v).toLowerCase().replace(/[^a-z0-9а-яё ]/gi,' ').split(/\s+/).filter(x=>x.length>2)}
function score(a,b){const aw=words(a),bw=words(b);let hit=0;for(const w of aw)if(bw.includes(w))hit++;return hit/Math.max(aw.length,1)}
async function search(mod){
 const key=process.env.NEXUS_API_KEY;if(!key)throw Error('NEXUS_API_KEY missing');
 const query=`query($filter: ModsFilter!){mods(filter:$filter,first:20){nodes{id name author{name}}}}`;
 const variants=[cleanName(mod.name),words(mod.name).slice(0,2).join(' '),mod.author];
 for(const name of variants){
  if(!name)continue;
  const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:{name}}})});
  const text=await r.text();
  let j={};try{j=JSON.parse(text)}catch{}
  if(j.errors)log('NEXUS ERROR '+JSON.stringify(j.errors).slice(0,300));
  const nodes=j.data?.mods?.nodes||[];
  log('NEXUS '+name+' results='+nodes.length);
  if(nodes.length){
   const best=nodes.map(n=>({...n,s:score(mod.name,n.name)+(String(n.author?.name||'').toLowerCase()===String(mod.author||'').toLowerCase()?0.5:0)})).sort((a,b)=>b.s-a.s)[0];
   if(best&&best.s>0.2){log('MATCH '+best.name+' id='+best.id);return String(best.id)}
  }
 }
 return null;
}
function parseInput(){const f=[path.join(__dirname,'..','input','mods_for_render_530.csv'),path.join(__dirname,'..','mods_for_render_530.csv')].find(x=>fs.existsSync(x));if(!f)return [];return fs.readFileSync(f,'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(l=>{let p=l.split(',');return{name:(p[0]||'').trim(),author:(p[1]||'').trim()}})}
async function run(mods){let found=[];save(stateFile,{running:true,total:mods.length,processed:0,status:'id_search',logs:[]});for(let i=0;i<mods.length;i++){let m=mods[i];try{log('Поиск: '+cleanName(m.name)+' | '+m.author);let id=await search(m);if(id){found.push({...m,modId:id});log('Найден Mod ID: '+id)}else log('Mod ID не найден')}catch(e){log('Ошибка: '+e.message)}save(stateFile,{...JSON.parse(fs.readFileSync(stateFile,'utf8')),processed:i+1,current:m.name,found:found.length})}save(outFile,found);setImmediate(()=>startRuWorker({queue:found}))}
module.exports=async(req,res)=>{if(running)return res.json({ok:true,status:'already_running'});let mods=parseInput();running=true;run(mods).finally(()=>running=false);res.json({ok:true,status:'started',total:mods.length})};