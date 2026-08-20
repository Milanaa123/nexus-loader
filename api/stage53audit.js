const AdmZip=require('adm-zip');
const BASE='https://nexus-loader.vercel.app/api/nexusarchive';
const ITEMS=[
 {name:"Mizu's Quail",src:{m:25028,f:169889,p:"[CP] Mizu's Quail/i18n/default.json"},base:{m:25028,f:169889,p:"[CP] Mizu's Quail/i18n/ru.json"},out:"Mods/[CP] Mizu's Quail/i18n/ru.json",patch:{
  'config.Enable Common Quail.name':'Включить обыкновенного перепела',
  'config.Enable Common Quail.description':'Включает внешний вид обыкновенного перепела и добавляет его в список возможных вариантов перепелов.',
  'config.Enable Scaled Quail.name':'Включить чешуйчатого перепела',
  'config.Enable Scaled Quail.description':'Включает внешний вид чешуйчатого перепела и добавляет его в список возможных вариантов перепелов.',
  'config.Disable Meat Recipes.name':'Отключить мясные рецепты',
  'config.Disable Meat Recipes.description':'По умолчанию выключено. Включите, чтобы убрать рецепты и книги, связанные с мясом и разделкой животных.'
 }},
 {name:"Mizu's Turkey",src:{m:25071,f:169890,p:"[CP] Mizu's Turkey/i18n/default.json"},base:{m:25071,f:169890,p:"[CP] Mizu's Turkey/i18n/ru.json"},out:"Mods/[CP] Mizu's Turkey/i18n/ru.json",patch:{
  'MarnieSpecialOrder_name':'Поговорим об индейках',
  'MarnieSpecialOrder_text':'Какая же осень без индейки? Если кто-нибудь сможет отгрузить немного зерна высокого качества, мне, возможно, удастся уговорить знакомых местных животноводов продать несколько чудесных индюшат по себестоимости. Кто-нибудь поможет?',
  'MarnieSpecialOrder_objective':'Отгрузите 20 единиц пшеницы золотого качества',
  'MarnieSpecialOrder_letterbody':'Привет, @!^Спасибо за поддержку местных животноводов! Когда на рынок поступает хороший корм, им гораздо легче выращивать здоровых птенцов. Если захочешь завести собственную индейку, заходи ко мне!^   — Марни',
  'MarnieSpecialOrder_lettertitle':'Индейки в продаже',
  'config.Enable Gray Turkey.name':'Включить серую индейку',
  'config.Enable Gray Turkey.description':'Включает внешний вид серой индейки и добавляет его в список возможных вариантов индеек.',
  'config.Disable Meat Recipes.name':'Отключить мясные рецепты',
  'config.Disable Meat Recipes.description':'По умолчанию выключено. Включите, чтобы убрать рецепты и книги, связанные с мясом и разделкой животных.'
 }},
 {name:'Night Market Expansion',src:{m:33400,f:165081,p:'Night Market Expansion/i18n/default.json'},base:{m:37102,f:141417,p:'ru.json'},out:'Mods/Night Market Expansion/i18n/ru.json',patch:{
  'Marnie.QuestDescription':'Вы можете отдать Марни лицензию на лис, чтобы она могла продавать лис в качестве питомцев.',
  'Marnie.Quest':'Отдайте Марни лицензию на лис.',
  'Marnie.Foxes':'Привет, @!^Теперь у меня есть лисы в продаже.^Ещё раз спасибо за лицензию!^\\t— Марни'
 }}
];
async function txt(x){const u=`${BASE}?modId=${x.m}&fileId=${x.f}&path=${encodeURIComponent(x.p)}`;const r=await fetch(u,{headers:{'User-Agent':'stage64-builder/1.0'}});const j=await r.json();if(!r.ok||!j.ok||typeof j.text!=='string')throw Error(`fetch ${x.m}/${x.f}/${x.p}: ${r.status} ${j.error||''}`);return j.text}
function strip(s){let o='',q=false,esc=false;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(q){if(c.charCodeAt(0)<32){o+=c==='\t'?'\\t':c==='\r'?'\\r':c==='\n'?'\\n':'';continue}o+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')q=false;continue}if(c==='"'){q=true;o+=c;continue}if(c==='/'&&n==='/'){while(i<s.length&&s[i]!=='\n')i++;o+='\n';continue}if(c==='/'&&n==='*'){i+=2;while(i<s.length-1&&!(s[i]==='*'&&s[i+1]==='/'))i++;i++;continue}o+=c}return o.replace(/,\s*([}\]])/g,'$1')}
function parse(s){return JSON.parse(strip(s.replace(/^\uFEFF/,'')))}
function requiredTokens(v){return (String(v).match(/\{\{[^}]+\}\}|@[A-Za-z0-9_.-]*|#\$[A-Za-z0-9]+|\$[A-Za-z0-9]+|\^/g)||[])}
function tokenOk(src,ru){const a=requiredTokens(src),b=requiredTokens(ru);for(const x of new Set(a)){if(b.filter(y=>y===x).length<a.filter(y=>y===x).length)return false}return true}
function visibleLatin(v){let s=String(v).replace(/\{\{[^}]+\}\}/g,'').replace(/@[A-Za-z0-9_.-]*/g,'').replace(/#\$[A-Za-z0-9]+/g,'').replace(/\$[A-Za-z0-9]+/g,'').replace(/\\t/g,'');return /[A-Za-z]{3,}/.test(s)}
module.exports=async(req,res)=>{try{const zip=new AdmZip(),rows=[];let complete=true;for(const it of ITEMS){const [ds,bs]=await Promise.all([txt(it.src),txt(it.base)]),D=parse(ds),R=parse(bs);const F={...R,...it.patch},dk=Object.keys(D),fk=Object.keys(F),missing=dk.filter(k=>!(k in F)),extra=fk.filter(k=>!(k in D)),badTokens=dk.filter(k=>k in F&&!tokenOk(D[k],F[k])),latin=dk.filter(k=>k in F&&visibleLatin(F[k]));const ok=missing.length===0&&extra.length===0&&badTokens.length===0&&latin.length===0;complete=complete&&ok;zip.addFile(it.out,Buffer.from(JSON.stringify(F,null,2)+'\n','utf8'));rows.push({name:it.name,sourceKeys:dk.length,finalRuKeys:fk.length,patchedKeys:Object.keys(it.patch).length,missing:missing.length,extra:extra.length,tokenMismatch:badTokens.length,remainingVisibleLatin:latin.length,missingKeys:missing,extraKeys:extra,tokenMismatchKeys:badTokens,latinKeys:latin,ok})}if(String(req.query.download||'')==='1'){if(!complete)return res.status(409).json({ok:false,stage:64,complete,rows});const b=zip.toBuffer();res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RU_STAGE64_VERIFIED.zip"');return res.send(b)}return res.json({ok:true,stage:64,mods:ITEMS.length,complete,rows})}catch(e){return res.status(500).json({ok:false,stage:64,error:String(e.message||e)})}};
