const fs = require('fs');

const stages = [
  'resolve_nexus_id',
  'check_latest_file',
  'find_ru_translation',
  'verify_translation_version',
  'move_ready_ru',
  'report'
];

const state = {
  project: 'Stardew Valley RU Pack',
  target: 'PC Steam Deck',
  stages,
  processed: 0,
  ready: 0,
  needTranslation: 0,
  failed: 0
};

fs.mkdirSync('data/RU_PACK_WORK/REPORTS', {recursive:true});
fs.writeFileSync('data/RU_PACK_WORK/pipeline-state.json', JSON.stringify(state,null,2));

console.log(JSON.stringify(state));
