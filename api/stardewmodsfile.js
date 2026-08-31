module.exports=async function(req,res){
  try{
    const id=String(req.query?.id||'').trim();
    if(!/^\d+$/.test(id)) return res.status(400).json({ok:false,error:'numeric id required'});
    const url=`https://stardewmods.ru/index.php?do=download&id=${id}`;
    const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Accept':'application/octet-stream,application/zip,*/*'}});
    const b=Buffer.from(await r.arrayBuffer());
    const sig=b.subarray(0,8).toString('hex');
    const ct=String(r.headers.get('content-type')||'application/octet-stream');
    if(!r.ok || b.length<20 || /text\/html/i.test(ct)) return res.status(502).json({ok:false,status:r.status,contentType:ct,bytes:b.length,finalUrl:r.url,sig,sample:b.subarray(0,160).toString('utf8')});
    res.setHeader('Content-Type',ct);
    res.setHeader('Content-Disposition',`attachment; filename="stardewmods-${id}.bin"`);
    res.setHeader('Content-Length',String(b.length));
    return res.send(b);
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
};
