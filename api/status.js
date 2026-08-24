const fs=require('fs');
const path=require('path');

module.exports=async function(req,res){
 const root=path.join(__dirname,'..');
 const generatorFile=path.join(root,'RU_PACK_WORK','generator_status.json');
 const progressFile=path.join(root,'RU_PACK_WORK','progress.json');
 let generator={},progress={};
 try{generator=JSON.parse(fs.readFileSync(generatorFile,'utf8'));}catch{}
 try{progress=JSON.parse(fs.readFileSync(progressFile,'utf8'));}catch{}

 let active;
 if(generator.running) active=generator;
 else if(progress.running) active=progress;
 else if(progress.status==='finished') active=progress;
 else active=generator.status?generator:progress;

 const logs=[...(generator.logs||[]),...(progress.logs||[])].slice(-300);
 return res.json({
  ok:true,
  running:Boolean(generator.running||progress.running),
  status:active.status||null,
  total:active.total||0,
  processed:active.processed||0,
  remaining:active.remaining!=null?active.remaining:Math.max(0,(active.total||0)-(active.processed||0)),
  current:active.current||null,
  foundModIds:generator.foundModIds||0,
  foundTranslations:progress.foundTranslations||0,
  noTranslations:progress.noTranslations||0,
  downloaded:progress.downloaded||0,
  failed:progress.failed||0,
  modId:active.modId||null,
  translationId:progress.translationId||null,
  logs,
  error:active.error||progress.error||generator.error||null
 });
};