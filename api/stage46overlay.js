const AdmZip=require('adm-zip');
const fs=require('fs');
const path=require('path');
const os=require('os');
const {execFileSync}=require('child_process');
const {path7za}=require('7zip-bin');

const SRC={
  arv:'https://stardewmods.ru/uploads/public_files/2025-05/arvsunberry.zip',
  jorts:'https://stardewmods.ru/uploads/public_files/2025-03/jorts-and-jean.zip'
};
const ARV_TEXT=[
  '[CP] Always Raining in the Valley/content.json',
  '[CP] Always Raining in the Valley/Data/Compatibility/CFD.json',
  '[CP] Always Raining in the Valley/Data/Compatibility/MobilePhone.json',
  '[CP] Always Raining in the Valley/Data/Compatibility/SVE.json',
  '[CP] Always Raining in the Valley/Data/EventData/SterlingEvents.json',
  '[CP] Always Raining in the Valley/Data/EventData/SterlingMarriage.json',
  '[CP] Always Raining in the Valley/Data/Mail.json',
  '[CP] Always Raining in the Valley/Data/NPCData.json',
  '[CP] Always Raining in the Valley/Data/Strings.json',
  '[CP] Always Raining in the Valley/i18n/ru.json'
];
function stripJsonc(s){let o='',ins=false,esc=false,line=false,block=false;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(line){if(c==='\n'){line=false;o+=c;}continue}if(block){if(c==='*'&&n==='/'){block=false;i++}else if(c==='\n')o+='\n';continue}if(ins){o+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')ins=false;continue}if(c==='"'){ins=true;o+=c;continue}if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}o+=c}return o.replace(/,\s*([}\]])/g,'$1')}
function parseJson(s){s=s.replace(/^\uFEFF/,'');try{return JSON.parse(s)}catch{return JSON.parse(stripJsonc(s))}}
function flat(obj,p='',out={}){if(obj&&typeof obj==='object'&&!Array.isArray(obj)){for(const[k,v]of Object.entries(obj))flat(v,p?`${p}.${k}`:k,out)}else out[p]=obj;return out}
async function getBuf(url,headers={}){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',...headers},redirect:'follow'});if(!r.ok)throw new Error(`fetch ${r.status} ${url}`);return Buffer.from(await r.arrayBuffer())}
async function nexusSword(){const key=process.env.NEXUS_API_KEY;if(!key)throw new Error('NEXUS_API_KEY missing');const lr=await fetch('https://api.nexusmods.com/v1/games/stardewvalley/mods/31849/files/166311/download_link.json',{headers:{apikey:key,'User-Agent':'nexus-loader/2.0'}});if(!lr.ok)throw new Error(`Nexus links ${lr.status}`);const links=await lr.json();const u=links.find(x=>x&&(x.URI||x.uri));if(!u)throw new Error('Nexus mirror missing');return getBuf(u.URI||u.uri)}
function entryMap(z){const m=new Map();for(const e of z.getEntries())if(!e.isDirectory)m.set(e.entryName,e);return m}
function add(out,name,data){out.addFile(name,Buffer.isBuffer(data)?data:Buffer.from(data,'utf8'))}
function jortsPart(src,out,report){const z=new AdmZip(src),m=entryMap(z),p='[NPC] Jorts and Jean/i18n/ru.json',e=m.get(p);if(!e)throw new Error('Jorts ru.json missing');const obj=parseJson(e.getData().toString('utf8'));if(Object.keys(flat(obj)).length!==1110)throw new Error('Jorts key count !=1110');if(!Object.prototype.hasOwnProperty.call(obj,'963070002.42'))throw new Error('Jorts target key missing');obj['963070002.42']='...$3#$b#Что?$3';const text=JSON.stringify(obj,null,2)+'\n';const chk=parseJson(text);if(Object.keys(flat(chk)).length!==1110||text.includes('#What?'))throw new Error('Jorts validation failed');add(out,'Mods/'+p,text);report.jorts={keys:1110,missing:0,patched:['963070002.42'],files:1}}
function arvPart(src,out,report){const z=new AdmZip(src),m=entryMap(z);for(const rel of ARV_TEXT){const full='Always Raining in the Valley SBV/'+rel,e=m.get(full);if(!e)throw new Error('ARV missing '+full);let data=e.getData();if(rel.endsWith('/i18n/ru.json')){const obj=parseJson(data.toString('utf8'));delete obj['Sterling.Marriage.OneKid_2'];obj['SterlingSobrietyAnniversary.26']="Что?!$11#$b#Стерлинг, ты столько всего умеешь.$2";const text=JSON.stringify(obj,null,2)+'\n';const f=flat(parseJson(text));if(Object.keys(f).length!==1835||!Object.prototype.hasOwnProperty.call(obj,'SterlingSobrietyAnniversary.26')||Object.prototype.hasOwnProperty.call(obj,'Sterling.Marriage.OneKid_2'))throw new Error('ARV parity validation failed');data=Buffer.from(text,'utf8')}add(out,'Mods/Always Raining in the Valley SBV/'+rel,data)}report.arv={keys:1835,missing:0,extra:0,patched:['SterlingSobrietyAnniversary.26'],removed:['Sterling.Marriage.OneKid_2'],files:ARV_TEXT.length}}
function walk(root,dir=root,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(root,p,out);else out.push(p)}return out}
function patchHandbook(s){const reps=[
['Opens GMCM for the Content Patcher component of S&S.','Открывает GMCM для компонента Content Patcher мода S&S.'],
['Opens GMCM for the SMAPI component of S&S.','Открывает GMCM для компонента SMAPI мода S&S.'],
['CP Config','Настройки CP'],['SMAPI Config','Настройки SMAPI'],
['Fantasia Alla Marcia - song_buff','Фантазия-марш - song_buff'],
['Battlefield Overture - song_battle','Увертюра поля битвы - song_battle'],
['Invigorating Encore - song_restoration','Бодрящий бис - song_restoration'],
['Enduring Melody - song_protection','Стойкая мелодия - song_protection'],
["Rogues' Humorsque - song_npcbuff",'Юмореска плутов - song_npcbuff'],
["Scherzo D'Inganno - song_attack",'Скерцо обмана - song_attack'],
['Ballad of Chronomancy - song_time','Баллада хрономантии - song_time'],
['Track of {{HorseName}} - song_horse','След {{HorseName}} - song_horse'],
["Druid's Lullaby - song_crop",'Колыбельная друида - song_crop'],
['A Walk In Adante - song_obelisk','Прогулка в анданте - song_obelisk']
];for(const[a,b]of reps)s=s.split(a).join(b);return s}
function keyCount(s){const re=/^\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/gm;let n=0;while(re.exec(s))n++;return n}
function swordPart(src,out,report){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s46-'));try{const arc=path.join(tmp,'src.7z'),dir=path.join(tmp,'out');fs.mkdirSync(dir);fs.writeFileSync(arc,src);execFileSync(path7za,['x',arc,`-o${dir}`,'-y'],{stdio:'pipe',timeout:30000});const files=walk(dir);let handbookOk=false,ruOk=false,smapiOk=false;for(const p of files){const rel=path.relative(dir,p).split(path.sep).join('/');let data=fs.readFileSync(p);if(rel==='Sword & Sorcery/[CP] Sword & Sorcery/i18n/ru/Handbook.json'){let s=data.toString('utf8');if(keyCount(s)!==95)throw new Error('Sword Handbook keys !=95');s=patchHandbook(s);for(const x of ['Opens GMCM for the','CP Config','SMAPI Config','Battlefield Overture','Invigorating Encore','Enduring Melody',"Rogues' Humorsque","Scherzo D'Inganno",'Ballad of Chronomancy','Druid\'s Lullaby','A Walk In Adante'])if(s.includes(x))throw new Error('Sword visible English remains: '+x);data=Buffer.from(s,'utf8');handbookOk=true}else if(rel==='Sword & Sorcery/[CP] Sword & Sorcery/i18n/ru/Ru.json'){if(keyCount(data.toString('utf8'))!==6278)throw new Error('Sword main RU keys !=6278');ruOk=true}else if(rel==='Sword & Sorcery/[SMAPI] Sword & Sorcery/i18n/ru.json'){if(keyCount(data.toString('utf8'))!==335)throw new Error('Sword SMAPI keys !=335');smapiOk=true}add(out,'Mods/'+rel,data)}if(!handbookOk||!ruOk||!smapiOk)throw new Error('Sword required RU files missing');report.sword={mainKeys:6278,handbookKeys:95,smapiKeys:335,missing:0,files:files.length,patchedVisibleHandbook:true}}finally{fs.rmSync(tmp,{recursive:true,force:true})}}

module.exports=async function handler(req,res){try{const part=String(req.query.part||'all3'),status=String(req.query.status||'')==='1',out=new AdmZip(),report={};if(part==='jorts'||part==='all3')jortsPart(await getBuf(SRC.jorts),out,report);if(part==='arv'||part==='all3')arvPart(await getBuf(SRC.arv),out,report);if(part==='sword'||part==='all3')swordPart(await nexusSword(),out,report);const buf=out.toBuffer();report.overlayFiles=out.getEntries().filter(e=>!e.isDirectory).length;report.zipBytes=buf.length;report.ok=true;if(status)return res.json(report);res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="RU_STAGE46_${part.toUpperCase()}_VERIFIED.zip"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)}catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)})}};
