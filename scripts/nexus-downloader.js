const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const DOWNLOADS = path.join(WORK, 'downloads');

function ensure(){
  fs.mkdirSync(DOWNLOADS,{recursive:true});
}

async function downloadMod({game='stardewvalley', modId, fileId}){
  if(!process.env.NEXUS_API_KEY) throw new Error('NEXUS_API_KEY missing');
  ensure();
  const headers={apikey:process.env.NEXUS_API_KEY,'User-Agent':'nexus-loader/ru-pack'};
  const url=`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`;
  const r=await fetch(url,{headers});
  if(!r.ok) throw new Error(`Nexus error ${r.status}`);
  const links=await r.json();
  const link=links[0]?.URI || links[0]?.uri;
  if(!link) throw new Error('No download link');
  const file=path.join(DOWNLOADS,`${modId}-${fileId}.zip`);
  const data=await fetch(link);
  if(!data.ok) throw new Error(`Download failed ${data.status}`);
  const buffer=Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(file,buffer);
  return file;
}

module.exports={downloadMod,ensure};
