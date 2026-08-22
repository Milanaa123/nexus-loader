const fs=require('fs');

const audit={
 checked:new Date().toISOString(),
 rules:[
  'compare mod version',
  'compare translation version',
  'mark outdated translations',
  'keep incompatible files out of READY_RU'
 ],
 status:'pending_files'
};

fs.mkdirSync('REPORTS',{recursive:true});
fs.writeFileSync('REPORTS/version-audit.json',JSON.stringify(audit,null,2));
