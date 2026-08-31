setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    for(const modId of ['40475','20109','23684','31958']){
      try{
        const r=await fetch(`http://127.0.0.1:${port}/api/nexusMeta?modId=${modId}`,{signal:AbortSignal.timeout(60000)});
        const j=await r.json();
        const files=(j.files||[]).filter(f=>String(f.category_name||'').toUpperCase()==='MAIN').sort((a,b)=>String(b.uploaded_time||'').localeCompare(String(a.uploaded_time||'')));
        const f=files[0]||j.files?.[0];
        console.log(`RU_META|mod=${modId}|status=${r.status}|file=${f?.file_id||''}|name=${f?.name||''}|version=${f?.version||''}|bytes=${f?.size_in_bytes||''}|preview=${f?.content_preview_link||''}`);
        if(f?.content_preview_link){
          const pr=await fetch(f.content_preview_link,{signal:AbortSignal.timeout(60000)});
          const txt=await pr.text();
          console.log(`RU_PREVIEW|mod=${modId}|status=${pr.status}|len=${txt.length}|${txt.slice(0,20000)}`);
        }
      }catch(e){console.log(`RU_META_ERROR|mod=${modId}|${String(e&&e.message||e)}`)}
    }
    console.log('RU_META_DONE');
  }catch(e){console.log('RU_META_FATAL|'+String(e&&e.stack||e));}
},10000);
