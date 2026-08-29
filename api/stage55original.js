const AdmZip=require('adm-zip');
const BASE='https://nexus-loader.vercel.app/api/nexusarchive';
const Y={modId:8174,fileId:101078,version:'1.2.1',files:[
 '[CP] Yagisan - Custom NPCs for NPC Map Locations/data/aspen.json',
 '[CP] Yagisan - Custom NPCs for NPC Map Locations/data/bh.json',
 '[CP] Yagisan - Custom NPCs for NPC Map Locations/data/es.json',
 '[CP] Yagisan - Custom NPCs for NPC Map Locations/data/rsv.json',
 '[CP] Yagisan - Custom NPCs for NPC Map Locations/data/zoro.json'
]};
const C={modId:31633,fileId:156469,version:'2.0.5',def:'[CP] More Content for Central Station/i18n/default.json',ru:'[CP] More Content for Central Station/i18n/ru.json'};
const MAP={"Aspen's Farm":'Ферма Аспен','Lost Valley':'Затерянная долина','Buffalo Ranch':'Ранчо Буффало','Boarding House':'Пансионат','East Scarp':'Ист-Скарп','The Orchard':'Сад','Meadow Farm':'Луговая ферма','Deep Mountains':'Глубокие горы','Lost Orchard':'Затерянный сад','Ridgeside Village Cable Car':'Канатная дорога деревни Риджсайд',"Zoro's BoatHouse":'Лодочный дом Зоро'};
const CFIX={
 'config.OMEGAlinc_EnablePossibleSpoilerTourists.description':'Переключает туристов, которые могут раскрывать подробности поздних событий игры.',
 'config.OMEGAlinc_ShopsCaveStyle.name':'Стиль пещеры магазинов',
 'config.OMEGAlinc_ShopsCaveStyle.description':'Изменяет стиль пещеры подземных магазинов.',
 'config.section.OMEGAlinc_Tourists.description':'Раздел настроек, связанных с туристами. Пока вариантов немного.',
 'config.section.OMEGAlinc_Visual.description':'Раздел настроек внешнего вида и стиля. Пока вариантов немного.'
};
async function txt(modId,fileId,p){const u=`${BASE}?modId=${modId}&fileId=${fileId}&path=${encodeURIComponent(p)}`;const r=await fetch(u,{headers:{'User-Agent':'nexus-loader-stage55/1.0'}});if(!r.ok)throw Error(`source ${modId}/${fileId} ${p}: ${r.status}`);const j=await r.json();if(!j.ok||typeof j.text!=='string')throw Error(`source text missing: ${p}`);return j.text}
function strip(s){let o='',q=0,e=0;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(q){o+=c;if(e)e=0;else if(c==='\\')e=1;else if(c==='"')q=0;continue}if(c==='"'){q=1;o+=c;continue}if(c==='/'&&n==='/'){while(i<s.length&&s[i]!=='\n')i++;o+='\n';continue}if(c==='/'&&n==='*'){i+=2;while(i<s.length-1&&!(s[i]==='*'&&s[i+1]==='/'))i++;i++;continue}o+=c}return o.replace(/,\s*([}\]])/g,'$1')}
function parse(s){return JSON.parse(strip(s.replace(/^\uFEFF/,'')))}
function sameKeys(a,b){const x=Object.keys(a).sort(),y=Object.keys(b).sort();return x.length===y.length&&x.every((k,i)=>k===y[i])}
function visibleLatin(v){return /[A-Za-z]{2,}/.test(String(v).replace(/\{\{[^}]+\}\}/g,'').replace(/\$\{[^}]+\}/g,'').replace(/\[[^\]]+\]/g,'').replace(/@[A-Za-z0-9_.-]*/g,'').replace(/#[A-Za-z0-9_.-]*/g,''))}
function patchMap(node,stats){if(Array.isArray(node)){for(const v of node)patchMap(v,stats);return}if(!node||typeof node!=='object')return;for(const[k,v]of Object.entries(node)){if(k==='PrimaryText'||k==='SecondaryText'){stats.seen++;if(typeof v!=='string'||!(v in MAP))throw Error(`unexpected map text: ${v}`);node[k]=MAP[v];stats.changed++;if(visibleLatin(node[k]))stats.latin.push(node[k]);}else patchMap(v,stats)}}
module.exports=async(req,res)=>{try{const z=new AdmZip(),ys={seen:0,changed:0,latin:[]};for(const p of Y.files){const raw=await txt(Y.modId,Y.fileId,p),o=parse(raw);patchMap(o,ys);z.addFile('Mods/'+p,Buffer.from(JSON.stringify(o,null,2)+'\n','utf8'))}if(ys.seen!==14||ys.changed!==14||ys.latin.length)throw Error(`Yagisan validation seen=${ys.seen} changed=${ys.changed} latin=${ys.latin.length}`);
 const[dRaw,rRaw]=await Promise.all([txt(C.modId,C.fileId,C.def),txt(C.modId,C.fileId,C.ru)]),D=parse(dRaw),R=parse(rRaw);if(Object.keys(D).length!==95||Object.keys(R).length!==95||!sameKeys(D,R))throw Error('Central 95-key parity failed');for(const[k,v]of Object.entries(CFIX)){if(!(k in R))throw Error('Central key missing '+k);R[k]=v}const latin=Object.keys(D).filter(k=>visibleLatin(R[k])).map(k=>({key:k,value:R[k]}));if(latin.length)throw Error('Central visible Latin remains: '+latin.map(x=>x.key).join(','));z.addFile('Mods/'+C.ru,Buffer.from(JSON.stringify(R,null,2)+'\n','utf8'));
 const files=z.getEntries().filter(e=>!e.isDirectory),buf=z.toBuffer(),status={ok:true,complete:true,stage:55,mods:2,files:files.length,zipBytes:buf.length,verified:[{name:"Yagisan's Custom NPCs for NPC Map Locations",version:Y.version,fileId:Y.fileId,mapTextOccurrences:ys.seen,translated:ys.changed,remainingVisibleLatin:ys.latin.length,files:Y.files.length,idsChanged:0},{name:'More Content for Central Station',version:C.version,fileId:C.fileId,defaultKeys:Object.keys(D).length,ruKeys:Object.keys(R).length,missing:0,extra:0,visibleLatinFixed:Object.keys(CFIX).length,remainingVisibleLatin:latin.length}]};if(String(req.query.status||'')==='1')return res.json(status);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RU_STAGE55_VERIFIED_2.zip"');res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)}catch(e){return res.status(500).json({ok:false,error:String(e.message||e)})}};
