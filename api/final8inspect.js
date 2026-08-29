const fs=require('fs');
const AdmZip=require('adm-zip');
const {downloadMod,chooseFile}=require('../scripts/nexus-downloader');

const MODS=[
 {n:168,name:'Dynamic Shane and Sterling',modId:10675,fileId:129882},
 {n:300,name:'Maggs Townsfolk Daily Dialogue Expansion',modId:31537,fileId:137300},
 {n:312,name:"Miihau's Events- Gender Neutrality Tokens Patches",modId:27161,fileId:111738},
 {n:358,name:'Nora The Herpetologist - Custom NPC for East Scarp',modId:18176,fileId:155655,translationId:33571},
 {n:498,name:'Trinkets To Treasures (Simplified)',modId:19091,fileId:120932,translationId:20653},
 {n:502,name:'Ultimate Guide To Clowning',modId:37926,fileId:164272},
 {n:505,name:'Unique Winter Star - Ridgeside Village',modId:30294,fileId:124322},
 {n:530,name:"farmerjack's Dialogue Expansions",modId:9972,fileId:46468}
];
function strip(s){let o='',q=false,e=false;for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];if(q){o+=c;if(e)e=false;else if(c==='\\')e=true;else if(c==='"')q=false;continue}if(c==='"'){q=true;o+=c;continue}if(c==='/'&&n==='/'){while(i<s.length&&s[i]!=='\n')i++;o+='\n';continue}if(c==='/'&&n==='*'){i+=2;while(i<s.length-1&&!(s[i]==='*'&&s[i+1]==='/'))i++;i++;continue}o+=c}return o.replace(/,\s*([}\]])/g,'$1')}
function parse(s){try{return JSON.parse(strip(String(s).replace(/^\uFEFF/,'')))}catch{return null}}
function leaves(v,out=[]){if(typeof v==='string')out.push(v);else if(Array.isArray(v))for(const x of v)leaves(x,out);else if(v&&typeof v==='object')for(const x of Object.values(v))leaves(x,out);return out}
function inspect(buf){const z=new AdmZip(buf),entries=z.getEntries().filter(e=>!e.isDirectory),json=[];let manifest=null;for(const e of entries){if(!/\.jsonc?$/i.test(e.entryName))continue;const obj=parse(e.getData().toString('utf8'));if(!obj)continue;const vals=leaves(obj),latin=vals.filter(x=>/[A-Za-z]{3,}/.test(x)).length,cyr=vals.filter(x=>/[А-Яа-яЁё]/.test(x)).length;const rec={path:e.entryName,strings:vals.length,latin,cyr,bytes:e.header.size};json.push(rec);if(/(^|\/)manifest\.json$/i.test(e.entryName)&&!manifest)manifest={path:e.entryName,Name:obj.Name||obj.name||null,UniqueID:obj.UniqueID||obj.uniqueID||null,Version:obj.Version||obj.version||null,ContentPackFor:obj.ContentPackFor?.UniqueID||obj.ContentPackFor?.uniqueID||null};}json.sort((a,b)=>b.strings-a.strings);const i18n=json.filter(x=>/\/i18n\//i.test('/'+x.path));return{entries:entries.length,jsonFiles:json.length,totalStrings:json.reduce((a,x)=>a+x.strings,0),totalLatin:json.reduce((a,x)=>a+x.latin,0),totalCyr:json.reduce((a,x)=>a+x.cyr,0),manifest,i18n,topJson:json.slice(0,25)} }
module.exports=async(req,res)=>{try{const results=[];for(const m of MODS){const d=await downloadMod({modId:m.modId,fileId:m.fileId}),buf=fs.readFileSync(d.path),orig=inspect(buf);let tr=null,trFile=null;if(m.translationId){try{const f=await chooseFile('stardewvalley',m.translationId);trFile={modId:m.translationId,fileId:Number(f.file_id),name:f.name||null,version:f.version||f.mod_version||null};const td=await downloadMod({modId:m.translationId,fileId:f.file_id});tr=inspect(fs.readFileSync(td.path));}catch(e){tr={error:e.message}}}results.push({...m,bytes:buf.length,original:orig,translationFile:trFile,translation:tr});}return res.json({ok:true,count:results.length,results});}catch(e){return res.status(500).json({ok:false,error:String(e.stack||e)})}};
