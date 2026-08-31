setTimeout(async()=>{
  try{
    const AdmZip=require('adm-zip');
    const key=process.env.NEXUS_API_KEY;
    const headers={APIKEY:key,'User-Agent':'nexus-loader/2.6','Application-Name':'nexus-loader','Application-Version':'2.6'};
    const modId='42256';
    const fr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,{headers,signal:AbortSignal.timeout(60000)});
    const fd=await fr.json(); const files=(fd.files||[]).filter(f=>f.file_id && String(f.category_name||'').toUpperCase()==='MAIN').sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
    const f=files[0]; if(!f) throw new Error('no main file');
    const dr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${f.file_id}/download_link.json`,{headers,signal:AbortSignal.timeout(60000)});
    const links=await dr.json(); const url=links[0]?.URI||links[0]?.uri; if(!url) throw new Error('no download url');
    const zr=await fetch(url,{signal:AbortSignal.timeout(120000)}); const buf=Buffer.from(await zr.arrayBuffer());
    const zip=new AdmZip(buf); const entries=zip.getEntries().filter(e=>!e.isDirectory && /(?:^|\/)ru\.json$/i.test(e.entryName));
    console.log(`RSVRI_META|file=${f.file_id}|name=${f.name}|bytes=${buf.length}|ruEntries=${entries.length}`);
    for(const e of entries){ const txt=e.getData().toString('utf8'); console.log(`RSVRI_BEGIN|${e.entryName}`); console.log(txt); console.log(`RSVRI_END|${e.entryName}`); }
    console.log('RSVRI_DONE');
  }catch(e){console.log('RSVRI_ERROR|'+String(e&&e.stack||e));}
},10000);
