const AdmZip = require('adm-zip');
const crypto = require('crypto');

const SOURCES = [
  ['Coiis_Hair_Sets_Pack.zip', ['http://127.0.0.1:PORT/api/missingNexus?which=coii']],
  ['HxW_Bakery_and_Cafe_Furniture.zip', ['http://127.0.0.1:PORT/api/missingNexus?which=hxw']],
  ['Anything_Anywhere.zip', ['https://github.com/Sparky56p/AnythingAnywhere/releases/download/1.8.2-unofficial.7-Sparky56p/AnythingAnywhere.1.8.2-unofficial.7-Sparky56p.zip']],
  ['Reset_Terrain_Features.zip', ['https://github.com/Lake1059/ResetTerrainFeatures_NET6/releases/download/1.0.3-unofficial.3-Lake1059/SDV_1.6.10_RTF-1.0.3-unofficial.3-Lake1059.zip']],
  ['Non_Destructive_NPCs.zip', ['https://forums.stardewvalley.net/attachments/nondestructivenpcs-1-6-0-zip.20119/']],
  ['ThreeHeartDancePartner.zip', ['https://forums.stardewvalley.net/attachments/threeheartdancepartner-1-1-2-unofficial-2-flyingtnt-zip.20678/']],
  ['Weather_Wonders_Beta.zip', [
    'https://edge.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip',
    'https://mediafilez.forgecdn.net/files/6861/103/Weather%20Wonders%20-%20Beta.zip',
    'https://www.curseforge.com/api/v1/mods/1016623/files/6861103/download'
  ]],
];

function scanZip(name, buf) {
  const z = new AdmZip(buf);
  const entries = z.getEntries().filter(e => !e.isDirectory);
  const manifests = [];
  let textFiles = 0, ruFiles = 0, visibleEnglishSamples = [];
  for (const e of entries) {
    const p = e.entryName;
    if (/manifest\.json$/i.test(p)) {
      try {
        const raw=e.getData().toString('utf8').replace(/^\uFEFF/,'');
        const j = JSON.parse(raw);
        manifests.push({ path:p, Name:j.Name||null, UniqueID:j.UniqueID||null, Version:j.Version||null });
      } catch {}
    }
    if (/(^|\/)i18n\/(ru|ru-RU)(\/|\.|$)/i.test(p) || /(^|\/)ru\.json$/i.test(p)) ruFiles++;
    if (!/\.(json|jsonc|txt|md)$/i.test(p) || e.header.size > 2000000) continue;
    textFiles++;
    let s=''; try { s=e.getData().toString('utf8'); } catch { continue; }
    const lines=s.split(/\r?\n/);
    for(let i=0;i<lines.length && visibleEnglishSamples.length<12;i++){
      const x=lines[i].trim();
      if (/[A-Za-z]{4,}/.test(x) && /["']?[A-Za-z][A-Za-z ,.!?'\-]{8,}/.test(x)) {
        visibleEnglishSamples.push({path:p,line:i+1,text:x.slice(0,220)});
      }
    }
  }
  return {name, bytes:buf.length, sha256:crypto.createHash('sha256').update(buf).digest('hex'), fileCount:entries.length, textFiles, ruFiles, manifests, visibleEnglishSamples};
}

async function fetchZip(urls,port){
  let last='no url';
  for(const raw of urls){
    const url=raw.replace('PORT',String(port));
    try{
      const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 nexus-loader/2.7'},signal:AbortSignal.timeout(300000)});
      if(!r.ok){last=`${url} HTTP ${r.status}`;continue;}
      const b=Buffer.from(await r.arrayBuffer());
      const sig=b.subarray(0,4).toString('hex');
      if(!['504b0304','504b0506','504b0708'].includes(sig)){last=`${url} not zip sig=${sig} ct=${r.headers.get('content-type')||''} bytes=${b.length}`;continue;}
      return {b,url};
    }catch(e){last=`${url} ${String(e&&e.message||e)}`;}
  }
  throw new Error(last);
}

async function probeBusStop(){
  try{
    const resolver=require('../api/generateIds');
    const variants=[
      'Revised Ridgeside Village Bus Stop Edit',
      'Ridgeside Village Bus Stop Edit',
      'Ridgeside Bus Stop Edit'
    ];
    for(const name of variants){
      const id=await resolver.searchMod({name,author:''}).catch(()=>null);
      console.log(`M537_BUS_NEXUS query=${JSON.stringify(name)} id=${id||'none'}`);
      if(id) return {id,name};
    }
  }catch(e){console.log('M537_BUS_NEXUS_ERROR '+String(e&&e.message||e));}
  return null;
}

setTimeout(async()=>{
  try {
    const port=process.env.PORT||10000;
    const bundle=new AdmZip();
    const report=[];
    for (const [name, urls] of SOURCES) {
      try {
        const {b,url}=await fetchZip(urls,port);
        const info=scanZip(name,b);
        bundle.addFile(name,b);
        report.push({ok:true,source:url,...info});
        console.log('M537_OK '+JSON.stringify({source:url,...info}));
      } catch(e) {
        const row={name,ok:false,error:String(e&&e.message||e)};
        report.push(row); console.log('M537_FAIL '+JSON.stringify(row));
      }
    }
    const bus=await probeBusStop();
    report.push({name:'Revised_Ridgeside_Village_Bus_Stop_Edit',ok:false,error:bus?`NEXUS_CANDIDATE_${bus.id}_${bus.name}`:'SOURCE_NOT_FOUND_VERIFIED'});
    bundle.addFile('REPORT.json',Buffer.from(JSON.stringify(report,null,2),'utf8'));
    const out=bundle.toBuffer();
    console.log(`M537_BUNDLE bytes=${out.length} sha256=${crypto.createHash('sha256').update(out).digest('hex')} ok=${report.filter(x=>x.ok).length} failed=${report.filter(x=>x.ok===false).length}`);
    const fd=new FormData(); fd.append('file',new Blob([out],{type:'application/zip'}),'missing-537-sources.zip');
    const ur=await fetch('https://tmpfiles.org/api/v1/upload',{method:'POST',body:fd,signal:AbortSignal.timeout(300000)});
    const txt=await ur.text(); console.log(`M537_TMP_UPLOAD status=${ur.status} body=${txt}`);
    try { const j=JSON.parse(txt); const page=j?.data?.url; if(page) console.log('M537_TMP_DIRECT='+page.replace(/^http:/,'https:').replace('tmpfiles.org/','tmpfiles.org/dl/')); } catch {}
  } catch(e) { console.error('M537_FATAL '+(e&&e.stack||e)); }
},12000);
