setTimeout(async()=>{
  try{
    const port=process.env.PORT||10000;
    const r=await fetch(`http://127.0.0.1:${port}/api/pkg50bundle?status=1`);
    console.log(`PKG50_BUNDLE_STATUS status=${r.status} body=${await r.text()}`);
  }catch(e){
    console.error('PKG50_STATUS_ERROR '+e.message);
  }
},8000);
