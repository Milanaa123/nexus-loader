const fs = require('fs');

const required = [
  'READY_RU',
  'UPDATED_MODS',
  'FIXED_TRANSLATIONS',
  'NEED_TRANSLATION',
  'REPORTS'
];

const report = {
  created: new Date().toISOString(),
  folders: required,
  checks: {
    translationRequired: true,
    versionCheckRequired: true,
    englishResidualCheckRequired: true
  }
};

fs.mkdirSync('data/RU_PACK_WORK', {recursive:true});
fs.writeFileSync('data/RU_PACK_WORK/final-validator-report.json', JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
