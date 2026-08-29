const crypto=require('crypto');
setTimeout(async()=>{try{const port=process.env.PORT||10000;const base=`http://127.0.0.1:${port}`;
 const sr=await fetch(`${base}/api/pkg50bundle?status=1`);console.log(`PKG50_BUNDLE_STATUS status=${sr.status} body=${await sr.text()}`);
 const r=await fetch(`${base}/api/pkg50bundle`);if(!r.ok)throw new Error(`bundle HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());const sha=crypto.createHash('sha256').update(b).digest('hex'),s=b.toString('base64'),chunkSize=12000,total=Math.ceil(s.length/chunkSize);console.log(`PKG50_TRANSFER_META bytes=${b.length} sha256=${sha} b64chars=${s.length} chunks=${total} chunkSize=${chunkSize}`);for(let i=0;i<total;i++){const c=s.slice(i*chunkSize,(i+1)*chunkSize),ch=crypto.createHash('sha256').update(c,'utf8').digest('hex');console.log(`PKG50_TRANSFER_CHUNK_${String(i).padStart(2,'0')} sha256=${ch} len=${c.length} data=${c}`);}
}catch(e){console.error('PKG50_TRANSFER_ERROR '+e.stack)}},8000);
