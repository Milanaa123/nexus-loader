const fs=require('fs');
const path=require('path');

function scan(dir){
 const result=[];
 if(!fs.existsSync(dir)) return result;
 for(const f of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,f.name);
  if(f.isDirectory()) result.push(...scan(p));
  else if(/(ru\.json|russian|ru\.txt|i18n)/i.test(f.name)) result.push(p);
 }
 return result;
}

const report={checked:new Date().toISOString(),translations:scan('READY_RU')};
fs.mkdirSync('REPORTS',{recursive:true});
fs.writeFileSync('REPORTS/translation-scan.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
