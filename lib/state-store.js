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

function recover(name){
  const target = file(name);
  const backup = `${target}.broken`;
  try {
    if (fs.existsSync(target)) fs.renameSync(target, backup);
  } catch (_) {}
}

function read(name, fallback = {}){
  const target = file(name);
  try{
    if(!fs.existsSync(target)) return fallback;
    const raw = fs.readFileSync(target, 'utf8');
    return JSON.parse(raw);
  }catch(error){
    recover(name);
    return fallback;
  }
}

function write(name, data){
  const target = file(name);
  const temp = `${target}.${process.pid}.tmp`;
  const payload = JSON.stringify(data, null, 2);
  fs.writeFileSync(temp, payload, 'utf8');
  fs.renameSync(temp, target);
}

function appendError(error){
  const errors = read('errors.json', []);
  errors.push({
    message: error.message || String(error),
    stack: error.stack || null,
    date: new Date().toISOString()
  });
  write('errors.json', errors.slice(-1000));
}

module.exports = {
  getProgress(){ return read('progress.json', {}); },
  saveProgress(data){ write('progress.json', data); },
  getProcessed(){ return read('processed.json', []); },
  saveProcessed(data){ write('processed.json', data); },
  getErrors(){ return read('errors.json', []); },
  saveErrors(data){ write('errors.json', data); },
  appendError
};
