const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const DOWNLOADS = path.join(WORK, 'downloads');

function ensure(){
  fs.mkdirSync(DOWNLOADS, {recursive:true});
}

async function downloadMod({game='stardewvalley', modId, fileId}){
  if(!process.env.NEXUS_API_KEY) throw new Error('NEXUS_API_KEY missing');
  const headers={apikey:process.env.NEXUS_API_KEY,'User-Agent':'nexus-loader/ru-pack'};
  const url=`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`;
  const r=await fetch(url,{headers});
  if(!r.ok) throw new Error(`Nexus error ${r.status}`);
  const links=await r.json();
  return links[0]?.URI || links[0]?.uri;
}

module.exports={downloadMod,ensure};
