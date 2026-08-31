setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    const r=await fetch(`http://127.0.0.1:${port}/api/tractor`,{signal:AbortSignal.timeout(240000)});
    const b=Buffer.from(await r.arrayBuffer());
    const crypto=require('crypto');
    if(!r.ok){console.log(`TRACTOR_ERROR|status=${r.status}|${b.toString('utf8').slice(0,1000)}`);return;}
    const s=b.toString('base64'),N=50000,count=Math.ceil(s.length/N);
    console.log(`TRACTOR_META|bytes=${b.length}|sha256=${crypto.createHash('sha256').update(b).digest('hex')}|chunks=${count}`);
    for(let i=0;i<count;i++)console.log(`TRACTOR_CHUNK|${String(i+1).padStart(4,'0')}|${s.slice(i*N,(i+1)*N)}`);
    console.log('TRACTOR_DONE');
  }catch(e){console.log('TRACTOR_FATAL|'+String(e&&e.stack||e));}
},10000);
