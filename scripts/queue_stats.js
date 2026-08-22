const fs=require('fs');
const file='data/queue/ru-pack-queue.json';
let q={total:0,processed:0,items:[]};
if(fs.existsSync(file)) q=JSON.parse(fs.readFileSync(file,'utf8'));
const stats={total:q.total||0,processed:q.processed||0,pending:(q.total||0)-(q.processed||0)};
fs.mkdirSync('data/RU_PACK_WORK/REPORTS',{recursive:true});
fs.writeFileSync('data/RU_PACK_WORK/REPORTS/queue-stats.json',JSON.stringify(stats,null,2));
console.log(JSON.stringify(stats));
