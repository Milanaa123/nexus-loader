const fs=require('fs');

const progressPath='data/RU_PACK_WORK/progress.json';
const progress=JSON.parse(fs.readFileSync(progressPath,'utf8'));

function classify(item){
  if(item.localization==='builtin_ru') return 'ready';
  if(item.translationModId) return 'translation_required';
  return 'search_required';
}

module.exports={classify,progress};
