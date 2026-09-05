const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

module.exports = async function(req, res){
  const name = String((req.query && req.query.name) || '').trim();
  if(!name) return res.status(400).json({ok:false,error:'name required'});

  const safe = path.basename(name);
  const outputDir = path.resolve(paths.outputDir);
  const file = path.join(outputDir, safe);

  if(!file.startsWith(outputDir + path.sep)) {
    return res.status(400).json({ok:false,error:'invalid path'});
  }

  if(!fs.existsSync(file)) {
    return res.status(404).json({ok:false,error:'archive not found'});
  }

  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition',`attachment; filename="${safe}"`);
  fs.createReadStream(file).pipe(res);
};
