const fs=require('fs');
const folders=['READY_RU','UPDATED_MODS','FIXED_TRANSLATIONS','NEED_TRANSLATION'];
const result={};
for(const f of folders){
 result[f]={exists:fs.existsSync('data/RU_PACK_WORK/'+f)};
}
fs.writeFileSync('data/RU_PACK_WORK/REPORTS/folder-check.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
