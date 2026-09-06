const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

const STATE_DIR = path.join(paths.root, 'data', 'state');

function ensureDir(){
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function file(name){
  ensureDir();
  return path.join(STATE_DIR, name);
}

function read(name, fallback = {}){
  try{
    const target = file(name);
    if(!fs.existsSync(target)) return fallback;
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  }catch(error){
    return fallback;
  }
}

function write(name, data){
  const target = file(name);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, target);
}

module.exports = {
  getProgress(){ return read('progress.json', {}); },
  saveProgress(data){ write('progress.json', data); },
  getProcessed(){ return read('processed.json', []); },
  saveProcessed(data){ write('processed.json', data); },
  getErrors(){ return read('errors.json', []); },
  saveErrors(data){ write('errors.json', data); }
};
