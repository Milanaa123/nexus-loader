const fs=require('fs');
const path=require('path');

module.exports=async function(req,res){
  const archive=path.join(__dirname,'..','RU_PACK_WORK','RU_TRANSLATIONS_107.zip');
  if(!fs.existsSync(archive)){
    return res.status(404).json({ok:false,error:'Archive is not ready yet'});
  }
  const stat=fs.statSync(archive);
  res.statusCode=200;
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Length',String(stat.size));
  res.setHeader('Content-Disposition','attachment; filename="RU_TRANSLATIONS_107.zip"');
  res.setHeader('Cache-Control','no-store');
  fs.createReadStream(archive).pipe(res);
};
