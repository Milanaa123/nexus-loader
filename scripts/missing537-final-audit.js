setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    const r=await fetch(`http://127.0.0.1:${port}/api/missing537bundle`,{signal:AbortSignal.timeout(300000)});
    if(!r.ok) throw new Error(`bundle HTTP ${r.status} ${await r.text()}`);
    const b=Buffer.from(await r.arrayBuffer());
    const crypto=require('crypto');
    const s=b.toString('base64'), N=10000, count=Math.ceil(s.length/N);
    console.log(`M537SRC_META|bytes=${b.length}|sha256=${crypto.createHash('sha256').update(b).digest('hex')}|chunks=${count}`);
    for(let i=0;i<count;i++) console.log(`M537SRC_CHUNK|${String(i+1).padStart(3,'0')}|${s.slice(i*N,(i+1)*N)}`);
    console.log('M537SRC_DONE');
  }catch(e){console.error('M537SRC_ERROR '+String(e&&e.stack||e));}
},12000);
