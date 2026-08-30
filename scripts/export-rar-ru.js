const fs=require('fs');
const path=require('path');
const {createExtractorFromData}=require('node-unrar-js');
const {downloadMod}=require('./nexus-downloader');
const ROOT=path.join(__dirname,'..');
const OUT=path.join(ROOT,'data','FINAL_RAR_RU');
const targets=[
 ['010','AdventurerGuild','12760','97925'],['011','Alecto','21921','89900'],['013','AlternativeTextures','13056','57889'],['023','Clint','41891','155586'],['032','Dao','34246','133043'],['033','DateNight','15555','107667'],['037','EliDylan','30021','123219'],['058','JortsJean','37740','146715'],['079','Ridgeside','8401','132387'],['094','SpousesReact','9450','44678'],['097','Arcanian','44822','163923'],['102','Trolley','49794','177077'],['104','UniqueGift','25189','103903'],['105','UniqueWinter','37138','142181'],['008','SecretForest','24601','101461']
];
function safe(s){return s.replace(/[^a-z0-9._-]+/gi,'_');}
async function extractRar(buf){
 const ab=Uint8Array.from(buf).buffer;
 const ex=await createExtractorFromData({data:ab});
 const {files}=ex.extract({files:h=>!h.flags.directory});
 const out=[];
 for(const f of files){if(!f.extraction)continue; const n=f.fileHeader.name; if(/(^|[\\/])ru(?:-RU)?\.json$/i.test(n)||/(^|[\\/])ru\.jsonc$/i.test(n)) out.push({name:n,data:Buffer.from(f.extraction).toString('utf8')});}
 return out;
}
async function run(){
 fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
 const report=[];
 for(const [idx,name,tid,fid] of targets){
  try{
   const dl=await downloadMod({game:'stardewvalley',modId:tid,fileId:fid}); const b=fs.readFileSync(dl.path);
   let files=[];
   if(b.slice(0,4).toString('ascii')==='Rar!') files=await extractRar(b);
   else {try{const AdmZip=require('adm-zip');const z=new AdmZip(b);files=z.getEntries().filter(e=>!e.isDirectory&&/(^|[\\/])ru(?:-RU)?\.json$/i.test(e.entryName)).map(e=>({name:e.entryName,data:e.getData().toString('utf8')}));}catch{}}
   let j=0;for(const f of files){j++;fs.writeFileSync(path.join(OUT,`${idx}_${safe(name)}_${String(j).padStart(2,'0')}.json`),f.data,'utf8');}
   report.push({idx,name,translationId:tid,fileId:fid,found:files.map(x=>x.name)});console.log(`RARRU|${idx}|${name}|${files.length}`);
  }catch(e){report.push({idx,name,error:e.message});console.log(`RARRU_ERR|${idx}|${name}|${e.message}`);}
 }
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
 // commit text exports to a dedicated branch so ChatGPT can fetch them directly.
 const {spawnSync}=require('child_process');
 const git=a=>spawnSync('git',a,{cwd:ROOT,encoding:'utf8',timeout:120000});
 git(['config','user.name','nexus-loader']);git(['config','user.email','nexus-loader@users.noreply.github.com']);
 git(['checkout','-B','final-rar-ru']);git(['add','-f','data/FINAL_RAR_RU']);
 const st=git(['status','--porcelain','data/FINAL_RAR_RU']);if(String(st.stdout).trim())git(['commit','-m','Export RAR5 RU JSON files']);
 const push=git(['push','-f','origin','HEAD:refs/heads/final-rar-ru']);console.log(`RARRU_PUSH|status=${push.status}|${String(push.stderr||'').slice(-500)}`);
 console.log('RARRU_DONE');
}
if(!global.__finalRarRu){global.__finalRarRu=true;setTimeout(()=>run().catch(e=>console.log('RARRU_FATAL|'+e.stack)),10000);}
module.exports={run};