const fs=require('fs');
const path=require('path');
const root='data/RU_PACK_WORK/REPORTS';
fs.mkdirSync(root,{recursive:true});
const files=fs.readdirSync(root);
fs.writeFileSync(path.join(root,'index.json'),JSON.stringify({updated:new Date().toISOString(),reports:files},null,2));
console.log('reports indexed',files.length);
