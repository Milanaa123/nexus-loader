const fs = require('fs');
const path = require('path');

module.exports = async function(req,res){
 const file=path.join(__dirname,'..','RU_PACK_WORK','ru_results.json');
 let results=[];
 try{results=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 return res.json({
  ok:true,
  total:results.length,
  downloaded:results.filter(x=>x.status==='downloaded').length,
  missingTranslation:results.filter(x=>x.status==='no_translation').length,
  failed:results.filter(x=>x.status==='failed').length,
  results
 });
};
