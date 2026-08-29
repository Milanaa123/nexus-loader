const AdmZip=require('adm-zip');
const S={cat:{m:36735,f:158956},potion:{m:27523,f:110690},bombs:{m:26141,f:107211},skip:{m:42940,f:169172},skipru:{m:44817,f:163921}};
async function dl(x){const u=`https://nexus-loader.vercel.app/api/nexus?action=proxyDownload&game=stardewvalley&modId=${x.m}&fileId=${x.f}`;const r=await fetch(u);if(!r.ok)throw Error(`download ${x.m}/${x.f}: ${r.status}`);return Buffer.from(await r.arrayBuffer())}
function es(b){return new AdmZip(b).getEntries().filter(e=>!e.isDirectory)}
function find(a,re){return a.find(e=>re.test('/'+e.entryName))}
function parse(e){return JSON.parse(e.getData().toString('utf8').replace(/^\uFEFF/,''))}
function add(z,p,o){z.addFile(p,Buffer.from(typeof o==='string'?o:JSON.stringify(o,null,2)+'\n','utf8'))}
function visibleLatin(s){return /[A-Za-z]{3,}/.test(String(s))}
const BOMB_RU={
 'config.upgrade_bombs.description':'Включить рецепты улучшения бомб?',
 'config.upgrade_bombs.name':'Улучшения бомб',
 'config.upgrade_bombs.values.Enabled':'Включено',
 'config.upgrade_bombs.values.Disabled':'Отключено',
 'crafting.cherry_bomb_upgrade.display':'Улучшить вишнёвую бомбу',
 'crafting.bomb_upgrade.display':'Улучшить бомбу'
};
const SKIP_VALUES={
 "Vanilla":'Оригинальный интерфейс',
 "Adventurer's Interface":'Интерфейс искателя приключений',
 "Bog's Forest UI":'Лесной интерфейс Богс',
 "Cat Valley":'Кошачья долина',
 "Citrus Interface":'Цитрусовый интерфейс',
 "DaisyNiko's Earthy Interface":'Земляной интерфейс ДейзиНико',
 "DBB's Victorian Gothic User Interface":'Викторианско-готический интерфейс ДББ',
 "Lavender Dreams UI":'Интерфейс «Лавандовые сны»',
 "Lynneas Witchy and Purple UI":'Ведьмин фиолетовый интерфейс Линнеи',
 "Magical Valley":'Волшебная долина',
 "Meow UI":'Интерфейс «Мяу»',
 "Natural Dark Wood Interface":'Интерфейс из натурального тёмного дерева',
 "Overgrown Flowery Interface":'Заросший цветочный интерфейс',
 "Pastel Pink Lolita Interface":'Пастельно-розовый интерфейс «Лолита»',
 "Starblue Valley":'Звёздно-синяя долина',
 "Starry Blue UI":'Звёздно-синий интерфейс',
 "Vanilla Accent Interface":'Оригинальный акцентный интерфейс',
 "Vintage Interface v1":'Винтажный интерфейс, версия 1',
 "Vintage Interface v2":'Винтажный интерфейс, версия 2',
 "Void's Weird Wonders":'Странные чудеса Пустоты',
 "VPR-Inspired UI":'Интерфейс в стиле ВПР'
};
module.exports=async(req,res)=>{try{
 const[catB,potB,bombB,skipB,skipRuB]=await Promise.all([dl(S.cat),dl(S.potion),dl(S.bombs),dl(S.skip),dl(S.skipru)]);
 const report=[],z=new AdmZip();
 // Pixie's catalogue: patch only the visible furniture display name; internal IDs and shop keys stay unchanged.
 const catE=find(es(catB),/\/content\.json$/i);if(!catE)throw Error('catalogue content missing');const catSrc=catE.getData().toString('utf8'),catIds=(catSrc.match(/PixieMCM_Catalogue/g)||[]).length,catEnglish=(catSrc.match(/Pixie's MCM Catalogue/g)||[]).length;if(catEnglish!==1)throw Error(`catalogue display occurrences ${catEnglish}`);const catOut=catSrc.replace("Pixie's MCM Catalogue",'Каталог мебели Пикси в стиле модерн середины века');if((catOut.match(/PixieMCM_Catalogue/g)||[]).length!==catIds)throw Error('catalogue IDs changed');if(catOut.includes("Pixie's MCM Catalogue"))throw Error('catalogue English remains');add(z,"Mods/[CP] Pixie's MCM Catalogue/content.json",catOut);report.push({name:"Pixie's Mid-Century Modern Catalogue",version:'1.0.2',fileId:158956,displayNamesTranslated:1,idsChanged:0,visibleLatin:0,ok:true});
 // Potion Shelf: both furniture entries share one visible name; patch values only.
 const potE=find(es(potB),/\/content\.json$/i);if(!potE)throw Error('potion content missing');const potSrc=potE.getData().toString('utf8'),potIds1=(potSrc.match(/OB7\.potionshelf/g)||[]).length,potIds2=(potSrc.match(/ob7\.potionshelf/g)||[]).length,potEnglish=(potSrc.match(/Potion Shelf/g)||[]).length;if(potEnglish!==2)throw Error(`potion display occurrences ${potEnglish}`);const potOut=potSrc.replace(/Potion Shelf/g,'Полка с зельями');if((potOut.match(/OB7\.potionshelf/g)||[]).length!==potIds1||(potOut.match(/ob7\.potionshelf/g)||[]).length!==potIds2)throw Error('potion IDs changed');if(potOut.includes('Potion Shelf'))throw Error('potion English remains');add(z,'Mods/[CP] Potion Shelf/content.json',potOut);report.push({name:"The Orangerie's Potion Shelf",version:'1.0',fileId:110690,displayNamesTranslated:2,idsChanged:0,visibleLatin:0,ok:true});
 // Upgradable Bombs: exact current six-key dictionary + replace the raw ConfigSchema tooltip so no English fallback remains.
 const bombEs=es(bombB),bombD=find(bombEs,/\/i18n\/default\.json$/i),bombC=find(bombEs,/\/content\.json$/i);if(!bombD||!bombC)throw Error('bomb source missing');const bombDef=parse(bombD),bdk=Object.keys(bombDef).sort(),brk=Object.keys(BOMB_RU).sort();if(bdk.length!==6||bdk.length!==brk.length||!bdk.every((k,i)=>k===brk[i]))throw Error('bomb key parity failed');if(Object.values(BOMB_RU).some(visibleLatin))throw Error('bomb visible English remains');let bombContent=bombC.getData().toString('utf8');const raw='Do you want to enable bomb upgrade recipes?';if((bombContent.match(/Do you want to enable bomb upgrade recipes\?/g)||[]).length!==1)throw Error('bomb raw description changed');bombContent=bombContent.replace(raw,'Включить рецепты улучшения бомб?');if(!bombContent.includes('{{i18n:crafting.cherry_bomb_upgrade.display}}')||!bombContent.includes('{{i18n:crafting.bomb_upgrade.display}}'))throw Error('bomb i18n tokens lost');add(z,'Mods/[CP] Upgradable Bombs/content.json',bombContent);add(z,'Mods/[CP] Upgradable Bombs/i18n/ru.json',BOMB_RU);report.push({name:'Upgradable Bombs',version:'1.0.1',fileId:107211,keys:6,missing:0,extra:0,rawDescriptionsTranslated:1,tokensPreserved:2,visibleLatin:0,ok:true});
 // Skip or Socialize: 0.0.7 has the same five keys as the existing 0.0.6 RU. Add translated dropdown labels without changing the internal AllowValues used in paths.
 const skipEs=es(skipB),skipDefE=find(skipEs,/\/i18n\/default\.json$/i),skipContentE=find(skipEs,/\/content\.json$/i),srE=find(es(skipRuB),/\/i18n\/ru\.json$/i)||find(es(skipRuB),/\/ru\.json$/i);if(!skipDefE||!skipContentE||!srE)throw Error('skip source missing');const skipDef=parse(skipDefE),skipBase=parse(srE),sdk=Object.keys(skipDef).sort(),sbk=Object.keys(skipBase).sort();if(sdk.length!==5||sdk.length!==sbk.length||!sdk.every((k,i)=>k===sbk[i]))throw Error('skip base RU parity failed');const skipRu={...skipBase};for(const[v,label]of Object.entries(SKIP_VALUES))skipRu[`config.Recolor.values.${v}`]=label;const allow=JSON.parse(skipContentE.getData().toString('utf8')).ConfigSchema.Recolor.AllowValues.split(',').map(x=>x.trim());if(allow.length!==21||allow.some(v=>!(v in SKIP_VALUES)))throw Error('skip AllowValues changed');if(Object.values(skipRu).some(v=>visibleLatin(v)))throw Error('skip visible English remains');add(z,'Mods/[CP] Skip or Socialize/i18n/ru.json',skipRu);report.push({name:'Skip or Socialize',originalVersion:'0.0.7',baseRuVersion:'0.0.6',originalKeys:5,baseRuKeys:5,missing:0,extra:0,dropdownLabelsTranslated:21,internalAllowValuesChanged:0,visibleLatin:0,ok:true});
 const files=z.getEntries().filter(e=>!e.isDirectory),buf=z.toBuffer(),complete=report.length===4&&report.every(x=>x.ok);const status={ok:true,complete,stage:53,mods:complete?4:0,files:files.length,zipBytes:buf.length,verified:report};if(String(req.query.status||'')==='1')return res.json(status);if(!complete)return res.status(409).json(status);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="RU_STAGE53_VERIFIED_4.zip"');res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)
 }catch(e){return res.status(500).json({ok:false,error:String(e.message||e)})}};
