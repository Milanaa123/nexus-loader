const fs = require('fs');
const path = require('path');

module.exports = function(req,res){
  const file = path.join(__dirname,'..','RU_PACK_WORK','ru_results.json');
  let results = [];
  try {
    results = JSON.parse(fs.readFileSync(file,'utf8'));
  } catch(e) {
    return res.json({ok:false,error:'Results not ready',results:[]});
  }

  const summary = {
    total: results.length,
    downloaded: results.filter(x=>x.status==='downloaded').length,
    noTranslation: results.filter(x=>x.status==='no_translation').length,
    failed: results.filter(x=>x.status==='error').length
  };

  return res.json({ok:true,summary,results});
};
