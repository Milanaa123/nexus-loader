const fs = require('fs');
const path = require('path');

module.exports = async function(req, res){
  const name = String((req.query && req.query.name) || '').trim();
  if(!name) return res.status(400).json({ok:false,error:'name required'});

  const safe = path.basename(name);
  const file = path.join(__dirname,'..','RU_PACK_WORK','output',safe);

  if(!file.startsWith(path.join(__dirname,'..','RU_PACK_WORK','output'))) {
    return res.status(400).json({ok:false,error:'invalid path'});
  }

  if(!fs.existsSync(file)) {
    return res.status(404).json({ok:false,error:'archive not found'});
  }

  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition',`attachment; filename="${safe}"`);
  fs.createReadStream(file).pipe(res);
};
