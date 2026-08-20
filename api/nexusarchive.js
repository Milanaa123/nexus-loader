const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { path7za } = require('7zip-bin');

const ALLOWED = new Set(['31849:166311']);

async function nexusJson(url, key) {
  const r = await fetch(url,{headers:{apikey:key,'User-Agent':'nexus-loader/2.0'}});
  const data = await r.json().catch(()=>null);
  if(!r.ok) throw new Error(`Nexus ${r.status}`);
  return data;
}
function walk(root, dir=root, out=[]) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(root,p,out);
    else out.push({path:path.relative(root,p).split(path.sep).join('/'),size:fs.statSync(p).size});
  }
  return out;
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  let tmp=null;
  try{
    const modId=Number(req.query.modId||31849),fileId=Number(req.query.fileId||166311);
    if(!ALLOWED.has(`${modId}:${fileId}`)) return res.status(403).json({ok:false,error:'archive not allowed'});
    const key=process.env.NEXUS_API_KEY;if(!key)return res.status(500).json({ok:false,error:'NEXUS_API_KEY missing'});
    const links=await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${fileId}/download_link.json`,key);
    const uri=Array.isArray(links)&&links.find(x=>x&&(x.URI||x.uri));
    if(!uri)return res.status(502).json({ok:false,error:'no mirror'});
    const rr=await fetch(uri.URI||uri.uri,{redirect:'follow'});if(!rr.ok)return res.status(502).json({ok:false,error:`mirror ${rr.status}`});
    const b=Buffer.from(await rr.arrayBuffer());
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nxa-')); const arc=path.join(tmp,'source.7z'),out=path.join(tmp,'out');fs.mkdirSync(out);
    fs.writeFileSync(arc,b);
    execFileSync(path7za,['x',arc,`-o${out}`,'-y'],{stdio:'pipe',timeout:30000});
    const files=walk(out);
    const wanted=req.query.path?String(req.query.path):null;
    if(!wanted)return res.json({ok:true,modId,fileId,archiveBytes:b.length,files});
    const safe=path.resolve(out,wanted);if(!safe.startsWith(path.resolve(out)+path.sep)||!fs.existsSync(safe))return res.status(404).json({ok:false,error:'file not found'});
    const data=fs.readFileSync(safe);if(data.length>4500000)return res.status(413).json({ok:false,error:'file too large'});
    return res.json({ok:true,path:wanted,size:data.length,text:data.toString('utf8')});
  }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)});}
  finally{if(tmp)try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
};
