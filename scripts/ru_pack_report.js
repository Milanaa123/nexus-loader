const fs=require('fs');

function report(){
 const p='data/RU_PACK_WORK/progress.json';
 const state=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
 const result={
  total:state.total||535,
  completed:state.done||0,
  failed:state.failed||0,
  timestamp:new Date().toISOString()
 };
 fs.mkdirSync('data/RU_PACK_WORK/REPORTS',{recursive:true});
 fs.writeFileSync('data/RU_PACK_WORK/REPORTS/status.json',JSON.stringify(result,null,2));
 return result;
}
module.exports=report;
