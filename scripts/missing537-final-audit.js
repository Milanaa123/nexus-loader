setTimeout(async()=>{
  try{
    const key=process.env.NEXUS_API_KEY;
    const headers={APIKEY:key,'User-Agent':'nexus-loader/2.6','Application-Name':'nexus-loader','Application-Version':'2.6'};
    const modId='42256';
    const fr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,{headers,signal:AbortSignal.timeout(60000)});
    const fd=await fr.json(); const files=(fd.files||[]).filter(f=>f.file_id && String(f.category_name||'').toUpperCase()==='MAIN').sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
    const f=files[0]; if(!f) throw new Error('no main file');
    console.log(`RSVRI_META|file=${f.file_id}|name=${f.name}|preview=${f.content_preview_link||''}|size=${f.size_in_bytes||''}`);
    if(!f.content_preview_link) throw new Error('no content_preview_link');
    const pr=await fetch(f.content_preview_link,{signal:AbortSignal.timeout(60000)}); const txt=await pr.text();
    console.log(`RSVRI_PREVIEW_BEGIN|status=${pr.status}|len=${txt.length}`); console.log(txt); console.log('RSVRI_PREVIEW_END');
  }catch(e){console.log('RSVRI_ERROR|'+String(e&&e.stack||e));}
},10000);
