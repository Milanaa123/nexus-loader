const fs = require('fs');
const path = require('path');

module.exports = async function(req,res){
 const root=path.join(__dirname,'..');
 const stateFile=path.join(root,'RU_PACK_WORK','generator_status.json');
 let data={};
 try{data=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
 return res.json({
  ok:true,
  running:Boolean(data.running),
  status:data.status||null,
  total:data.total||0,
  processed:data.processed||0,
  remaining:Math.max(0,(data.total||0)-(data.processed||0)),
  current:data.current||null,
  foundTranslations:data.foundTranslations||0,
  noTranslations:data.noTranslations||0,
  downloaded:data.downloaded||0,
  failed:data.failed||0,
  logs:data.logs||[],
  error:data.error||null
 });
};
