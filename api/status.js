const fs = require('fs');
const path = require('path');

module.exports = async function(req,res){
 const root=path.join(__dirname,'..');
 const generatorFile=path.join(root,'RU_PACK_WORK','generator_status.json');
 const progressFile=path.join(root,'RU_PACK_WORK','progress.json');

 let generator={};
 let progress={};
 try{generator=JSON.parse(fs.readFileSync(generatorFile,'utf8'));}catch{}
 try{progress=JSON.parse(fs.readFileSync(progressFile,'utf8'));}catch{}

 const logs=[...(generator.logs||[]),...(progress.logs||[])].slice(-200);

 return res.json({
  ok:true,
  running:Boolean(progress.running || generator.running),
  status:progress.status||generator.status||null,
  total:progress.total||generator.total||0,
  processed:progress.processed||generator.processed||0,
  remaining:Math.max(0,(progress.total||generator.total||0)-(progress.processed||generator.processed||0)),
  current:progress.current||generator.current||null,
  foundTranslations:progress.foundTranslations||generator.foundTranslations||0,
  noTranslations:progress.noTranslations||generator.noTranslations||0,
  downloaded:progress.downloaded||generator.downloaded||0,
  failed:progress.failed||generator.failed||0,
  modId:progress.modId||generator.modId||null,
  translationId:progress.translationId||generator.translationId||null,
  logs,
  error:progress.error||generator.error||null
 });
};
