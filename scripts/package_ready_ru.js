const fs=require('fs');
const path=require('path');

const folders=['READY_RU','UPDATED_MODS','FIXED_TRANSLATIONS'];
const pack={created:new Date().toISOString(),folders:{}};
for(const f of folders){
 pack.folders[f]=fs.existsSync(f)?fs.readdirSync(f):[];
}
fs.mkdirSync('REPORTS',{recursive:true});
fs.writeFileSync('REPORTS/ready-pack.json',JSON.stringify(pack,null,2));
console.log(pack);
