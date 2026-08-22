const fs=require('fs');

const manifest={
 project:'Stardew Valley RU Pack',
 target:['PC','Steam Deck'],
 status:'building',
 folders:['READY_RU','UPDATED_MODS','FIXED_TRANSLATIONS','REPORTS']
};

fs.mkdirSync('data/RU_PACK_WORK',{recursive:true});
fs.writeFileSync('data/RU_PACK_WORK/release-manifest.json',JSON.stringify(manifest,null,2));
console.log(manifest);
