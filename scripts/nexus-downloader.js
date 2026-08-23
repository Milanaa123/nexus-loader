const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORK = path.join(ROOT, 'RU_PACK_WORK');
const DOWNLOADS = path.join(WORK, 'downloads');

function ensure(){
  fs.mkdirSync(DOWNLOADS,{recursive:true});
}

async function request(url, options = {}, retries = 3){
  let lastError;
  for(let i = 0; i < retries; i++){
    try{
      const r = await fetch(url, options);
      if(r.ok) return r;
      lastError = new Error(`HTTP ${r.status}`);
    }catch(e){
      lastError = e;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  }
  throw lastError || new Error('Request failed');
}

async function downloadMod({game='stardewvalley', modId, fileId}){
  if(!process.env.NEXUS_API_KEY) throw new Error('NEXUS_API_KEY missing');
  if(!modId || !fileId) throw new Error('modId/fileId missing');

  ensure();

  const headers={
    apikey:process.env.NEXUS_API_KEY,
    'User-Agent':'nexus-loader/ru-pack'
  };

  const url=`https://api.nexusmods.com/v1/games/${game}/mods/${modId}/files/${fileId}/download_link.json`;
  const r=await request(url,{headers});
  const links=await r.json();
  const link=links[0]?.URI || links[0]?.uri;

  if(!link) throw new Error('No download link');

  const file=path.join(DOWNLOADS,`${modId}-${fileId}.zip`);

  const data=await request(link);
  const buffer=Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(file,buffer);

  return file;
}

module.exports={downloadMod,ensure};
