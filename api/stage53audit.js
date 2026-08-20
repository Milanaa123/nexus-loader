const BASE='https://nexus-loader.vercel.app/api/nexusarchive';
const PAIRS=[
 {name:'Lurking in the Dark',src:{m:10770,f:147258,p:'Lurking in the Dark/i18n/default.json'},ru:{m:17988,f:130745,p:'Lurking in the Dark/i18n/ru.json'}},
 {name:'Night Market Expansion',src:{m:33400,f:165081,p:'Night Market Expansion/i18n/default.json'},ru:{m:37102,f:141417,p:'ru.json'}},
 {name:'Mr. Ginger',src:{m:5295,f:122912,p:'[CP] MrGinger/i18n/default.json'},ru:{m:12066,f:127331,p:'[CP] MrGinger/i18n/ru.json'}}
];
async function txt(x){const u=`${BASE}?modId=${x.m}&fileId=${x.f}&path=${encodeURIComponent(x.p)}`;const r=await fetch(u,{headers:{'User-Agent':'stage64-delta-audit/1.1'}});const j=await r.json();if(!r.ok||!j.ok||typeof j.text!=='string')throw Error(`fetch ${x.m}/${x.f}/${x.p}: ${r.status} ${j.error||''}`);return j.text}
function strip(s){let o='',q=false,esc=false;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(q){o+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')q=false;continue}if(c==='"'){q=true;o+=c;continue}if(c==='/'&&n==='/'){while(i<s.length&&s[i]!=='\n')i++;o+='\n';continue}if(c==='/'&&n==='*'){i+=2;while(i<s.length-1&&!(s[i]==='*'&&s[i+1]==='/'))i++;i++;continue}o+=c}return o.replace(/,\s*([}\]])/g,'$1')}
function parse(s){return JSON.parse(strip(s.replace(/^\uFEFF/,'')))}
function scrub(v){return String(v).replace(/\{\{[^}]+\}\}/g,'').replace(/\$\{[^}]+\}/g,'').replace(/\[[^\]]+\]/g,'').replace(/@[A-Za-z0-9_.-]*/g,'').replace(/#[A-Za-z0-9_.-]*/g,'').replace(/\/(?:message|pause|shake|playSound|emote|faceDirection|move|warp|viewport|animate|end)\b/gi,'')}
function latin(v){return /[A-Za-z]{3,}/.test(scrub(v))}
module.exports=async(req,res)=>{const out=[];for(const p of PAIRS){try{const [ds,rs]=await Promise.all([txt(p.src),txt(p.ru)]),D=parse(ds),R=parse(rs),dk=Object.keys(D),rk=Object.keys(R),missing=dk.filter(k=>!(k in R)),extra=rk.filter(k=>!(k in D)),latinKeys=dk.filter(k=>k in R&&latin(R[k]));out.push({name:p.name,ok:true,sourceKeys:dk.length,ruKeys:rk.length,missing:missing.length,missingEntries:missing.map(k=>({key:k,value:D[k]})),extra:extra.length,extraKeys:extra,visibleLatin:latinKeys.length,latinEntries:latinKeys.slice(0,120).map(k=>({key:k,value:R[k]}))})}catch(e){out.push({name:p.name,ok:false,error:String(e.message||e)})}}return res.json({ok:true,stage:64,pairs:out})};
