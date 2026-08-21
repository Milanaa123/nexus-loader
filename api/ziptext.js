module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const url='https://stardewmods.ru/index.php?do=download&id=301';
    const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/zip,application/octet-stream;q=0.9,*/*;q=0.8','Referer':'https://stardewmods.ru/load/mods/adventurer-s-guild-expanded/1-1-0-301'}});
    const b=Buffer.from(await r.arrayBuffer());
    return res.json({ok:true,status:r.status,statusText:r.statusText,finalUrl:r.url,contentType:r.headers.get('content-type'),contentDisposition:r.headers.get('content-disposition'),bytes:b.length,firstText:b.subarray(0,8000).toString('utf8'),firstHex:b.subarray(0,64).toString('hex')});
  }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)})}
};
