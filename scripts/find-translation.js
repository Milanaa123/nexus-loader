const fetch = global.fetch;

async function findTranslation({game='stardewvalley', modName, author, modId}) {
 const key=process.env.NEXUS_API_KEY;
 if(!key) throw new Error('NEXUS_API_KEY missing');
 const query='query($filter: ModsFilter!){mods(filter:$filter,first:100){nodes{id name author{name}}}}';
 const r=await fetch('https://api.nexusmods.com/v2/graphql',{method:'POST',headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},body:JSON.stringify({query,variables:{filter:{name:modName}}})});
 const data=await r.json();
 const mods=data.data?.mods?.nodes||[];
 const base=(modName||'').toLowerCase();
 const authorNorm=(author||'').toLowerCase();
 const translation=mods.find(m=>{const n=(m.name||'').toLowerCase();const a=(m.author?.name||'').toLowerCase();return (n.includes('russian')||n.includes('рус')||n.includes('translation')||n.includes('перевод'))&&(n.includes(base)||base.includes(n)||a===authorNorm)});
 if(!translation)return null;
 return {originalModId:modId||null,translationId:String(translation.id),translationName:translation.name,translationAuthor:translation.author?.name||null};
}
module.exports={findTranslation};
