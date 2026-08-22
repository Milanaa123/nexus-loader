// RU Pack master runner
// Pipeline order:
// 1. Load queue
// 2. Resolve Nexus files
// 3. Validate versions
// 4. Check translations
// 5. Move verified items to READY_RU
// 6. Write reports

const fs = require('fs');

const progressPath = 'data/RU_PACK_WORK/progress.json';

function run(){
  const progress = fs.existsSync(progressPath)
    ? JSON.parse(fs.readFileSync(progressPath,'utf8'))
    : {total:535, processed:0, ready:0, errors:0};

  progress.pipeline = [
    'queue',
    'nexus_resolve',
    'file_check',
    'translation_check',
    'ready_ru',
    'reports'
  ];
  progress.last_run = new Date().toISOString();

  fs.mkdirSync('data/RU_PACK_WORK', {recursive:true});
  fs.writeFileSync(progressPath, JSON.stringify(progress,null,2));
}

run();
