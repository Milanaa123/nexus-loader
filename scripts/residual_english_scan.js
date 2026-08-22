const fs = require('fs');
const path = require('path');

const bannedPatterns = [/[A-Za-z]{4,}/];

function scan(dir){
 let result=[];
 if(!fs.existsSync(dir)) return result;
 for(const f of fs.readdirSync(dir)){
  const p=path.join(dir,f);
  const s=fs.statSync(p);
  if(s.isDirectory()) result=result.concat(scan(p));
 }
 return result;
}

module.exports={scan,bannedPatterns};
