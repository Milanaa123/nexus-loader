setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    const r=await fetch(`http://127.0.0.1:${port}/api/tractor`,{signal:AbortSignal.timeout(300000)});
    if(!r.ok) throw new Error(`tractor HTTP ${r.status} ${await r.text()}`);
    const b=Buffer.from(await r.arrayBuffer());
    const crypto=require('crypto');
    const s=b.toString('base64'), N=8000, count=Math.ceil(s.length/N);
    console.log(`TRACTOR_META|bytes=${b.length}|sha256=${crypto.createHash('sha256').update(b).digest('hex')}|chunks=${count}`);
    for(let i=0;i<count;i++) console.log(`TRACTOR_CHUNK|${String(i+1).padStart(4,'0')}|${s.slice(i*N,(i+1)*N)}`);
    console.log('TRACTOR_DONE');
  }catch(e){console.error('TRACTOR_ERROR '+String(e&&e.stack||e));}
},12000);
