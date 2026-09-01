setTimeout(async()=>{
  const AdmZip=require('adm-zip');
  const ids=['15555','30004','12760'];
  const key=process.env.NEXUS_API_KEY;
  const headers={APIKEY:key,'User-Agent':'nexus-loader/2.7','Application-Name':'nexus-loader','Application-Version':'2.7'};
  for(const modId of ids){
    try{
      const fr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,{headers,signal:AbortSignal.timeout(60000)});
      const fd=await fr.json();
      const fs=(fd.files||[]).filter(f=>f.file_id&&!['ARCHIVED','REMOVED'].includes(String(f.category_name||'').toUpperCase())).sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
      const f=fs[0]; if(!f) throw new Error('no file');
      const dr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${f.file_id}/download_link.json`,{headers,signal:AbortSignal.timeout(60000)});
      const links=await dr.json(); const url=links[0]?.URI||links[0]?.uri; if(!url) throw new Error('no link');
      const rr=await fetch(url,{signal:AbortSignal.timeout(120000)}); if(!rr.ok) throw new Error(`download ${rr.status}`);
      const buf=Buffer.from(await rr.arrayBuffer()); const zip=new AdmZip(buf);
      const entries=zip.getEntries().filter(e=>!e.isDirectory&&/i18n[\\/]ru\.json$/i.test(e.entryName));
      console.log(`RUTRANS_META|${modId}|file=${f.file_id}|name=${f.name}|bytes=${buf.length}|ruFiles=${entries.length}`);
      for(const e of entries){
        const txt=e.getData().toString('utf8'); const n=7000, count=Math.ceil(txt.length/n);
        console.log(`RUTRANS_FILE|${modId}|${e.entryName}|chars=${txt.length}|chunks=${count}`);
        for(let i=0;i<count;i++) console.log(`RUTRANS_CHUNK|${modId}|${e.entryName}|${i}|${txt.slice(i*n,(i+1)*n)}`);
        console.log(`RUTRANS_END|${modId}|${e.entryName}`);
      }
    }catch(e){console.log(`RUTRANS_ERROR|${modId}|${String(e&&e.message||e)}`);}
  }
  console.log('RUTRANS_DONE');
},10000);
