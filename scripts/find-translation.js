const GRAPHQL='https://api.nexusmods.com/v2/graphql';

function clean(v=''){return String(v).replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();}
function norm(v=''){return clean(v).toLowerCase().replace(/[^a-z0-9а-яё]+/gi,' ').replace(/\s+/g,' ').trim();}
function words(v=''){return norm(v).split(' ').filter(Boolean);}
function ruMarker(name=''){return /\brussian\b|\brus\b|\bru\b|рус(?:ский|ификатор|ская|ское|ские)?|перевод/i.test(name);}
function coreWords(v=''){
 const stop=new Set(['russian','rus','ru','translation','translate','translated','перевод','русский','русская','русское','русские','русификатор','русификация','version','версия','for','для']);
 return words(v).filter(w=>!stop.has(w));
}
function similarity(base,candidate){
 const a=coreWords(base),b=coreWords(candidate);if(!a.length||!b.length)return {score:0,recall:0,precision:0};
 const hit=a.filter(w=>b.includes(w)).length;const recall=hit/a.length;const precision=b.filter(w=>a.includes(w)).length/b.length;
 const exact=a.join(' ')===b.join(' ');let score=recall*110+precision*90+(exact?120:0);
 const an=a.join(' '),bn=b.join(' ');if(an.length>3&&bn.includes(an))score+=50;
 return {score,recall,precision};
}
function headers(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');return {'Content-Type':'application/json','APIKEY':key,'User-Agent':'nexus-loader/2.2','Application-Name':'nexus-loader','Application-Version':'2.2'};}

async function gqlSearch(game,q){
 const query=`query NexusLoaderTranslationSearch($filter: ModsFilter, $count: Int) {\n  mods(filter: $filter, count: $count) {\n    totalCount\n    nodes { modId name author uploader { name memberId } game { domainName name id } version status }\n  }\n}`;
 const variables={filter:{gameDomainName:{value:game,op:'EQUALS'},name:{value:q,op:'WILDCARD'}},count:40};
 const r=await fetch(GRAPHQL,{method:'POST',headers:headers(),body:JSON.stringify({query,variables})});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Nexus GraphQL HTTP ${r.status}: ${text.slice(0,160)}`);}
 if(!r.ok)throw new Error(`Nexus GraphQL HTTP ${r.status}: ${JSON.stringify(data).slice(0,220)}`);
 if(data.errors&&data.errors.length)throw new Error('Nexus GraphQL: '+data.errors.map(e=>e.message).join(' | ').slice(0,260));
 return data.data?.mods?.nodes||[];
}

function variants(modName){
 const base=clean(modName);const short=coreWords(base).slice(0,6).join(' ');
 return [...new Set([`${base} Russian`,`${base} Rus`,`${base} RU`,`${short} Russian`,base].filter(Boolean))].slice(0,5);
}

async function findTranslation({game='stardewvalley',modName,author,modId}){
 let all=[];
 for(const q of variants(modName)){
  try{all.push(...await gqlSearch(game,q));}catch(e){if(!all.length&&/HTTP 401|HTTP 403|APIKEY missing/.test(e.message))throw e;}
 }
 const unique=[...new Map(all.filter(x=>x&&x.modId).map(x=>[String(x.modId),x])).values()].filter(x=>String(x.modId)!==String(modId||''));
 const ranked=unique.filter(x=>ruMarker(x.name||'')).map(x=>{const sim=similarity(modName,x.name||'');return {...x,_score:sim.score,_recall:sim.recall,_precision:sim.precision};}).sort((a,b)=>b._score-a._score);
 const best=ranked[0];
 if(!best||best._recall<0.6||best._precision<0.4||best._score<120)return null;
 return {originalModId:modId||null,translationId:String(best.modId),translationName:best.name,translationAuthor:best.author||best.uploader?.name||null,score:Number(best._score.toFixed(1)),recall:Number(best._recall.toFixed(2)),precision:Number(best._precision.toFixed(2))};
}

module.exports={findTranslation,similarity,ruMarker};