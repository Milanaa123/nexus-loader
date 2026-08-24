const fs=require('fs');
const path=require('path');
const {start:startRuWorker}=require('../scripts/ru-pack-worker');

const ROOT=path.join(__dirname,'..');
const WORK=path.join(ROOT,'RU_PACK_WORK');
const stateFile=path.join(WORK,'generator_status.json');
const outFile=path.join(WORK,'mods_with_ids.json');
const GRAPHQL='https://api.nexusmods.com/v2/graphql';
let running=false;

function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2),'utf8');}
function readState(){try{return JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{return {};}}
function log(message){const s=readState();s.logs=s.logs||[];s.logs.push(new Date().toISOString()+' '+message);if(s.logs.length>300)s.logs=s.logs.slice(-300);save(stateFile,s);}
function clean(v=''){return String(v).replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();}
function norm(v=''){return clean(v).toLowerCase().replace(/[^a-z0-9а-яё]+/gi,' ').replace(/\s+/g,' ').trim();}
function words(v=''){return norm(v).split(' ').filter(Boolean);}
function nameScore(target,candidate){const a=words(target),b=words(candidate);if(!a.length||!b.length)return 0;const exact=norm(target)===norm(candidate)?1:0;const recall=a.filter(w=>b.includes(w)).length/a.length;const precision=b.filter(w=>a.includes(w)).length/b.length;return exact*100+recall*60+precision*20;}
function authorScore(expected,node){if(!expected)return 0;const e=norm(expected);const values=[node.author,node.uploader&&node.uploader.name].filter(Boolean).map(norm);return values.includes(e)?40:0;}
function headers(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');return {'Content-Type':'application/json','APIKEY':key,'User-Agent':'nexus-loader/2.1','Application-Name':'nexus-loader','Application-Version':'2.1'};}

async function gqlSearch(game,q,op='WILDCARD',count=20){
 const query=`query NexusLoaderSearch($filter: ModsFilter, $count: Int) {\n  mods(filter: $filter, count: $count) {\n    totalCount\n    nodes { modId name author uploader { name memberId } game { domainName name id } version status }\n  }\n}`;
 const variables={filter:{gameDomainName:{value:game,op:'EQUALS'},name:{value:q,op}},count};
 const r=await fetch(GRAPHQL,{method:'POST',headers:headers(),body:JSON.stringify({query,variables})});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Nexus GraphQL HTTP ${r.status}: ${text.slice(0,180)}`);}
 if(!r.ok)throw new Error(`Nexus GraphQL HTTP ${r.status}: ${JSON.stringify(data).slice(0,220)}`);
 if(data.errors&&data.errors.length)throw new Error('Nexus GraphQL: '+data.errors.map(e=>e.message).join(' | ').slice(0,260));
 return data.data?.mods?.nodes||[];
}

function variants(name){
 const base=clean(name);
 const stripped=base.replace(/\b(CP|AT|SMAPI|Content Patcher|Alternative Textures)\b/gi,' ').replace(/\s+/g,' ').trim();
 const short=words(stripped).slice(0,5).join(' ');
 return [...new Set([base,stripped,short].filter(Boolean))].slice(0,3);
}

async function searchMod(mod){
 let candidates=[];
 const base=clean(mod.name);
 try{
  const exact=await gqlSearch('stardewvalley',base,'EQUALS',20);
  log(`NEXUS EXACT ${base} results=${exact.length}`);
  candidates.push(...exact);
 }catch(e){log(`NEXUS EXACT ERROR ${base} ${e.message}`);}
 if(!candidates.length){
  for(const q of variants(mod.name)){
   try{
    const list=await gqlSearch('stardewvalley',q,'WILDCARD',30);
    log(`NEXUS WILDCARD ${q} results=${list.length}`);
    candidates.push(...list);
   }catch(e){log(`NEXUS ERROR ${q} ${e.message}`);}
  }
 }
 const unique=[...new Map(candidates.filter(x=>x&&x.modId).map(x=>[String(x.modId),x])).values()];
 const ranked=unique.map(x=>({...x,_score:nameScore(mod.name,x.name||'')+authorScore(mod.author,x)})).sort((a,b)=>b._score-a._score);
 const best=ranked[0];
 if(best&&best._score>=55){log(`MATCH ${best.name} | ${best.author||best.uploader?.name||''} | id=${best.modId} | score=${best._score.toFixed(1)}`);return String(best.modId);}
 log(`NO MATCH ${clean(mod.name)} candidates=${unique.length}${best?` best=${best.name} score=${best._score.toFixed(1)}`:''}`);
 return null;
}

function parseCsvLine(line){const out=[];let cur='';let quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;}
function input(){
 const files=[path.join(ROOT,'input','mods_for_render_530.csv'),path.join(ROOT,'mods_for_render_530.csv')];
 const file=files.find(f=>fs.existsSync(f));if(!file)return[];
 return fs.readFileSync(file,'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(line=>{const p=parseCsvLine(line);return{name:(p[0]||'').trim(),author:(p[1]||'').trim()};}).filter(x=>x.name);
}

async function run(mods){
 const found=[];save(stateFile,{running:true,total:mods.length,processed:0,remaining:mods.length,status:'id_search',foundModIds:0,logs:[]});
 for(let i=0;i<mods.length;i++){
  const mod=mods[i];log(`Поиск: ${clean(mod.name)} | ${mod.author}`);
  const id=await searchMod(mod).catch(e=>{log('ERROR '+e.message);return null;});
  if(id)found.push({...mod,modId:id});
  const s=readState();save(stateFile,{...s,running:true,status:'id_search',total:mods.length,processed:i+1,remaining:mods.length-i-1,current:mod.name,modId:id,foundModIds:found.length});
 }
 save(outFile,found);
 const s=readState();save(stateFile,{...s,running:false,status:'id_search_finished',current:null,remaining:0,foundModIds:found.length});
 log(`ID SEARCH FINISHED found=${found.length}/${mods.length}`);
 if(found.length)await startRuWorker({queue:found});
}

module.exports=async(req,res)=>{
 if(running)return res.json({ok:true,status:'already_running'});
 const mods=input();
 if(!mods.length)return res.status(500).json({ok:false,error:'mods_for_render_530.csv not found or empty'});
 running=true;run(mods).catch(e=>{const s=readState();save(stateFile,{...s,running:false,status:'error',error:e.message});}).finally(()=>{running=false;});
 return res.json({ok:true,status:'started',total:mods.length});
};