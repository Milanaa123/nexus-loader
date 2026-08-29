module.exports=async function(req,res){
  try{
    const allowed={
      '18092':{fileId:97534,label:'haley-ru'},
      '24334':{fileId:100631,label:'shane-ru'},
      '18728':{fileId:null,label:'abigail-ru'}
    };
    const modId=String(req.query?.modId||'').trim();
    const spec=allowed[modId];
    if(!spec)return res.status(403).json({ok:false,error:'mod not allowed'});
    const key=process.env.NEXUS_API_KEY;
    if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const headers={APIKEY:key,'User-Agent':'nexus-loader/2.6','Application-Name':'nexus-loader','Application-Version':'2.6'};
    let fileId=Number(req.query?.fileId||spec.fileId||0),meta=null;
    if(!fileId){
      const fr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files.json`,{headers});
      if(!fr.ok)return res.status(fr.status).json({ok:false,error:`files HTTP ${fr.status}`});
      const fd=await fr.json();
      const files=Array.isArray(fd)?fd:(fd.files||[]);
      const main=files.filter(f=>f&&f.file_id&&(String(f.category_name||'').toUpperCase()==='MAIN'||Number(f.category_id)===1))
        .sort((a,b)=>Number(b.uploaded_timestamp||0)-Number(a.uploaded_timestamp||0));
      meta=main.find(f=>f.is_primary)||main[0]||null;
      if(!meta)return res.status(404).json({ok:false,error:'no MAIN file'});
      fileId=Number(meta.file_id);
    }
    const lr=await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${fileId}/download_link.json`,{headers});
    if(!lr.ok)return res.status(lr.status).json({ok:false,error:`download_link HTTP ${lr.status}`,fileId});
    const links=await lr.json();
    const uri=Array.isArray(links)&&links.find(x=>x&&(x.URI||x.uri));
    if(!uri)return res.status(502).json({ok:false,error:'no mirror',fileId});
    const rr=await fetch(uri.URI||uri.uri,{redirect:'follow'});
    if(!rr.ok)return res.status(502).json({ok:false,error:`mirror HTTP ${rr.status}`,fileId});
    const b=Buffer.from(await rr.arrayBuffer());
    if(b.length>2*1024*1024)return res.status(413).json({ok:false,error:'archive too large',bytes:b.length});
    if(String(req.query?.raw||'')==='1'){
      res.setHeader('Content-Type','application/zip');
      res.setHeader('Content-Length',String(b.length));
      res.setHeader('Content-Disposition',`attachment; filename="${spec.label}.zip"`);
      return res.send(b);
    }
    return res.json({ok:true,modId,fileId,label:spec.label,fileName:meta?.file_name||null,bytes:b.length,base64:b.toString('base64')});
  }catch(e){return res.status(500).json({ok:false,error:e.message||String(e)});}
};
