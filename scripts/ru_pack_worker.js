const fs = require('fs');

const statePath = 'data/RU_PACK_WORK/progress.json';

function loadState(){
  if(!fs.existsSync(statePath)) return {total:535, done:0, failed:0, queue:[]};
  return JSON.parse(fs.readFileSync(statePath,'utf8'));
}

function saveState(state){
  fs.mkdirSync('data/RU_PACK_WORK',{recursive:true});
  fs.writeFileSync(statePath, JSON.stringify(state,null,2));
}

function processBatch(limit=50){
  const state=loadState();
  const batch=state.queue.splice(0,limit);
  state.current_batch=batch.length;
  state.updated=new Date().toISOString();
  saveState(state);
  return state;
}

module.exports={processBatch};
