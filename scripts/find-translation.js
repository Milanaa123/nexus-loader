const fetch = global.fetch;

function clean(v=''){
 return v.toLowerCase()
  .replace(/\([^)]*\)/g,'')
  .replace(/\[[^\]]*\]/g,'')
  .replace(/[^a-z0-9а-яё]/gi,'');
}

function score(name, author, target, targetAuthor){
 let s=0;
 const n=clean(name), t=clean(target);
 if(n===t) s+=100;
 if(n.includes(t)||t.includes(n)) s+=50;
 if(targetAuthor && clean(author)===clean(targetAuthor)) s+=30;
 if(/russian|рус|translation|перевод|ru/i.test(name)) s+=40;
 return s;
}

async function findTranslation({game='stardewvalley', modName, author, modId}) {
 const key=process.env.NEXUS_API_KEY;
 if(!key) throw new Error('NEXUS_API_KEY missing');
 const query='query($filter: ModsFilter!){mods(filter:$filter,first:100){nodes{id name author{name}}}}';
 const searches=[modName, modName.replace(/^\([^)]*\)\s*/,'')];
 let all=[];
 for(const name of searches){
  const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:{name}}})});
  const data=await r.json();
  all.push(...(data.data?.mods?.nodes||[]));
 }
 const unique=[...new Map(all.map(x=>[x.id,x])).values()];
 const ru=unique
  .filter(m=>/russian|рус|translation|перевод|ru/i.test(m.name||''))
  .map(m=>({...m,_score:score(m.name,m.author?.name||'',modName,author)}))
  .sort((a,b)=>b._score-a._score)[0];
 if(!ru || ru._score<50) return null;
 return {originalModId:modId||null,translationId:String(ru.id),translationName:ru.name,translationAuthor:ru.author?.name||null};
}
module.exports={findTranslation};
