const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}

function listFiles(dir){
 const result=[];
 if(!dir||!fs.existsSync(dir))return result;
 for(const item of fs.readdirSync(dir)){
  const full=path.join(dir,item);
  const stat=fs.statSync(full);
  if(stat.isDirectory())result.push(...listFiles(full));
  else result.push(full);
 }
 return result;
}

function hasManifest(dir){return listFiles(dir).some(file=>path.basename(file).toLowerCase()==='manifest.json');}

function mergeDirectories(sourceDir,translationDir,outputZip){
 const zip=new AdmZip();
 const sources=[];
 if(sourceDir&&fs.existsSync(sourceDir)){zip.addLocalFolder(sourceDir);sources.push('original');}
 if(translationDir&&fs.existsSync(translationDir)){zip.addLocalFolder(translationDir);sources.push('translation');}
 if(!sources.length)throw new Error('No directories available for archive merge');
 ensureDir(path.dirname(outputZip));
 zip.writeZip(outputZip);
 const size=fs.statSync(outputZip).size;
 if(size===0)throw new Error('Created archive is empty');
 return {output:outputZip,sources,size,sha256:crypto.createHash('sha256').update(fs.readFileSync(outputZip)).digest('hex')};
}

function validateModFolder(dir){
 const exists=!!dir&&fs.existsSync(dir);
 const files=exists?listFiles(dir):[];
 return {exists,fileCount:files.length,hasManifest:exists?hasManifest(dir):false,valid:exists&&files.length>0};
}

module.exports={mergeDirectories,validateModFolder};
