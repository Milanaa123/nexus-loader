const AdmZip=require('adm-zip');
const MOD={modId:5996,fileId:36703,version:'1.2.0'};
const NAMES={
  'Transmute Back (Cu)':'Обратная трансмутация (Cu)',
  'Transmute Back (Fe)':'Обратная трансмутация (Fe)',
  'Transmute Back (Au)':'Обратная трансмутация (Au)',
  'Transmute (Ir)':'Трансмутация (Ir)',
  'Transmute Back (Ir)':'Обратная трансмутация (Ir)',
  'Transmute (Rad)':'Трансмутация (Rad)'
};
const CONFIG={
  'config.EnableIridiumTransmutations.name':'Иридиевые трансмутации',
  'config.EnableIridiumTransmutations.description':'Включает трансмутации с иридиевыми слитками.',
  'config.EnableRadioactiveTransmutations.name':'Радиоактивные трансмутации',
  'config.EnableRadioactiveTransmutations.description':'Включает трансмутации с радиоактивными слитками.',
  'config.GoldBarRequiredForIridium.name':'Золотых слитков для иридия',
  'config.GoldBarRequiredForIridium.description':'Количество золотых слитков, необходимое для трансмутации в иридиевый слиток.',
  'config.IridiumBarRequiredForRadioactive.name':'Иридиевых слитков для радиоактивного',
  'config.IridiumBarRequiredForRadioactive.description':'Количество иридиевых слитков, необходимое для трансмутации в радиоактивный слиток.'
};
async function getEnglish(){const u='https://nexus-loader.vercel.app/api/stage50audit?source=bar&path='+encodeURIComponent('[CP] More Bar Transmutations/assets/en.json');const r=await fetch(u);if(!r.ok)throw new Error(`source ${r.status}`);const j=await r.json();if(!j.ok||!j.text)throw new Error('source missing');return JSON.parse(j.text)}
function patch(o){let count=0;const seen=[];for(const change of o.Changes||[]){for(const [key,val] of Object.entries(change.Entries||{})){const ru=NAMES[key];if(!ru)throw new Error('unexpected recipe '+key);const p=String(val).split('/');if(p.length<6)throw new Error('recipe schema '+key);p[p.length-1]=ru;change.Entries[key]=p.join('/');count++;seen.push(key)}}return{obj:o,count,seen}}
module.exports=async function handler(req,res){try{const src=await getEnglish(),p=patch(src);if(p.count!==6||p.seen.length!==Object.keys(NAMES).length)throw new Error('recipe count mismatch');for(const v of Object.values(CONFIG))if(!/[А-Яа-яЁё]/.test(v)||/[A-Za-z]{4,}/.test(v))throw new Error('English in config RU');const serialized=JSON.stringify(p.obj);for(const token of ['{{GoldBarRequiredForIridium}}','{{IridiumBarRequiredForRadioactive}}'])if(!serialized.includes(token))throw new Error('token lost '+token);const zip=new AdmZip();zip.addFile('Mods/[CP] More Bar Transmutations/assets/ru.json',Buffer.from(JSON.stringify(p.obj,null,2)+'\n','utf8'));zip.addFile('Mods/[CP] More Bar Transmutations/i18n/ru.json',Buffer.from(JSON.stringify(CONFIG,null,2)+'\n','utf8'));const buf=zip.toBuffer();const report={ok:true,stage:50,mods:1,name:'More Bar Transmutations',version:MOD.version,fileId:MOD.fileId,recipesTranslated:p.count,configUiStrings:Object.keys(CONFIG).length,internalRecipeKeysChanged:0,tokensPreserved:2,files:2,zipBytes:buf.length};if(String(req.query.status||'')==='1')return res.json(report);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RU_STAGE50_MORE_BAR_1.2.0_VERIFIED.zip"');res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)}catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)})}}
