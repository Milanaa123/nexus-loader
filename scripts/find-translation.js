const GRAPHQL='https://api.nexusmods.com/v2/graphql';

function clean(v=''){return String(v).replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();}
function norm(v=''){return clean(v).toLowerCase().replace(/[^a-z0-9а-яё]+/gi,' ').replace(/\s+/g,' ').trim();}
function words(v=''){return norm(v).split(' ').filter(Boolean);}
function overlapScore(base,candidate){const a=words(base),b=words(candidate);if(!a.length||!b.length)return 0;return a.filter(w=>b.includes(w)).length/a.length;}
function ruMarker(name=''){return /\brussian\b|\brus\b|\bru\b|рус(?:ский|ификатор|ская|ское|ские)?|перевод|translation/i.test(name);}
function headers(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');return {'Content-Type':'application/json','APIKEY':key,'User-Agent':'nexus-loader/2.0','Application-Name':'nexus-loader','Application-Version':'2.0'};}

async function gqlSearch(game,q){
 const query=`query NexusLoaderTranslationSearch($filter: ModsFilter, $count: Int) {\n  mods(filter: $filter, count: $count) {\n    totalCount\n    nodes { modId name author uploader { name memberId } game { domainName name id } version status }\n  }\n}`;
 const variables={filter:{gameDomainName:{value:game,op:'EQUALS'},name:{value:q,op:'WILDCARD'}},count:30};
 const r=await fetch(GRAPHQL,{method:'POST',headers:headers(),body:JSON.stringify({query,variables})});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Nexus GraphQL HTTP ${r.status}: ${text.slice(0,160)}`);}
 if(!r.ok)throw new Error(`Nexus GraphQL HTTP ${r.status}: ${JSON.stringify(data).slice(0,220)}`);
 if(data.errors&&data.errors.length)throw new Error('Nexus GraphQL: '+data.errors.map(e=>e.message).join(' | ').slice(0,260));
 return data.data?.mods?.nodes||[];
}

function variants(modName){
 const base=clean(modName);
 const short=words(base).slice(0,6).join(' ');
 return [...new Set([`${base} Russian`,`${base} Russian Translation`,`${short} Russian`,base].filter(Boolean))].slice(0,4);
}

async function findTranslation({game='stardewvalley',modName,author,modId}){
 let all=[];
 for(const q of variants(modName)){
  try{all.push(...await gqlSearch(game,q));}catch(e){if(!all.length&&/HTTP 401|HTTP 403|APIKEY missing/.test(e.message))throw e;}
 }
 const unique=[...new Map(all.filter(x=>x&&x.modId).map(x=>[String(x.modId),x])).values()]
  .filter(x=>String(x.modId)!==String(modId||''));
 const ranked=unique
  .filter(x=>ruMarker(x.name||''))
  .map(x=>{const ov=overlapScore(modName,x.name||'');const baseNorm=norm(modName);const candNorm=norm(x.name||'');let s=ov*100+50;if(candNorm.includes(baseNorm)&&baseNorm.length>3)s+=40;return {...x,_score:s,_overlap:ov};})
  .sort((a,b)=>b._score-a._score);
 const best=ranked[0];
 if(!best||best._overlap<0.35||best._score<75)return null;
 return {originalModId:modId||null,translationId:String(best.modId),translationName:best.name,translationAuthor:best.author||best.uploader?.name||null,score:best._score};
}

module.exports={findTranslation};