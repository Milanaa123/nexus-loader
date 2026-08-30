setTimeout(async()=>{
  try {
    const port=process.env.PORT||10000;
    for (const revision of [78,72]) {
      try {
        const r=await fetch(`http://127.0.0.1:${port}/api/m537last?slug=g3i395&revision=${revision}`,{signal:AbortSignal.timeout(60000)});
        const t=await r.text();
        console.log(`M537LAST_RESULT|revision=${revision}|status=${r.status}|${t}`);
      } catch(e) {
        console.log(`M537LAST_ERROR|revision=${revision}|${String(e&&e.message||e)}`);
      }
    }
    console.log('M537LAST_DONE');
  } catch(e) {
    console.error('M537LAST_FATAL '+(e&&e.stack||e));
  }
},12000);
