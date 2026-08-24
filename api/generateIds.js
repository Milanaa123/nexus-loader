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
const score=(a,b)=>{let x=norm(a).split(' '),y=norm(b).split(' ');return x.filter(v=>v&&y.includes(v)).length/Math.max(x.length,1)};

async function getText(url){let r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 nexus-loader'}});if(!r.ok)throw Error('HTTP '+r.status);return await r.text()}

async function search(m){
 const name=clean(m.name);
 const queries=[name, name.replace(/\b(CP|AT|SMAPI|1\.6)\b/gi,'').trim()];
 let best=null;
 for(const q of queries){
  try{
   const html=await getText('https://www.nexusmods.com/stardewvalley/search/?gsearch='+encodeURIComponent(q));
   const links=[...html.matchAll(/href="https:\/\/www\.nexusmods\.com\/stardewvalley\/mods\/(\d+)/g)].map(x=>x[1]);
   const ids=[...new Set(links)];
   log('NEXUS SEARCH '+q+' ids='+ids.length);
   for(const id of ids.slice(0,10)){
    let title='';
    try{title=(await getText('https://www.nexusmods.com/stardewvalley/mods/'+id)).match(/<title>(.*?)<\/title>/i)?.[1]||''}catch{}
    const s=score(name,title);
    if(!best||s>best.s)best={id,title,s};
   }
  }catch(e){log('NEXUS SEARCH FAIL '+q+' '+e.message)}
 }
 if(best&&best.s>0.25){log('MATCH '+best.title+' id='+best.id);return String(best.id)}
 log('NO MATCH '+name);
 return null;
}

function input(){let f=path.join(__dirname,'..','input','mods_for_render_530.csv');if(!fs.existsSync(f))return[];return fs.readFileSync(f,'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(x=>{let p=x.split(',');return{name:p[0],author:p[1]||''}})}

async function run(ms){let found=[];save(stateFile,{running:true,total:ms.length,processed:0,status:'id_search',logs:[]});for(let i=0;i<ms.length;i++){let m=ms[i];log('Поиск: '+m.name+' | '+m.author);let id=await search(m).catch(e=>{log('ERR '+e.message);return null});if(id)found.push({...m,modId:id});save(stateFile,{...JSON.parse(fs.readFileSync(stateFile,'utf8')),processed:i+1,current:m.name,remaining:ms.length-i-1})}save(outFile,found);startRuWorker({queue:found})}

module.exports=async(req,res)=>{if(running)return res.json({ok:true,status:'already_running'});running=true;run(input()).finally(()=>running=false);res.json({ok:true,status:'started'})};