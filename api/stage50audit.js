const fs=require('fs');
const path=require('path');
const os=require('os');
const {execFileSync}=require('child_process');
const {path7za}=require('7zip-bin');
const AdmZip=require('adm-zip');

async function nexusJson(url,key){
  const r=await fetch(url,{headers:{apikey:key,'User-Agent':'nexus-loader-stage50audit/1.0'}});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(`Nexus ${r.status}`);
  return j;
}
function walk(root,dir=root,out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())walk(root,p,out);else out.push({path:path.relative(root,p).split(path.sep).join('/'),full:p});
  }
  return out;
}
module.exports=async function handler(req,res){
  let tmp=null;
  try{
    if(String(req.query.source||'')!=='bar')return res.status(400).json({ok:false,error:'unsupported source'});
    const key=process.env.NEXUS_API_KEY;
    if(!key)throw new Error('NEXUS_API_KEY missing');
    const modId=5996,fileId=36703;
    const links=await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${modId}/files/${fileId}/download_link.json`,key);
    const m=(links||[]).find(x=>x&&(x.URI||x.uri));
    if(!m)throw new Error('no mirror');
    const rr=await fetch(m.URI||m.uri,{redirect:'follow'});
    if(!rr.ok)throw new Error(`mirror ${rr.status}`);
    const buf=Buffer.from(await rr.arrayBuffer());
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s50-'));
    const arc=path.join(tmp,'archive.bin'),out=path.join(tmp,'out');
    fs.mkdirSync(out);fs.writeFileSync(arc,buf);
    try{execFileSync(path7za,['x',arc,`-o${out}`,'-y'],{stdio:'pipe',timeout:30000});}
    catch(e){
      const z=new AdmZip(buf);z.extractAllTo(out,true);
    }
    const wanted=String(req.query.path||'[CP] More Bar Transmutations/assets/en.json').replace(/^\/+/, '');
    const files=walk(out);
    let hit=files.find(x=>x.path.toLowerCase()===wanted.toLowerCase());
    if(!hit){
      const base=path.posix.basename(wanted).toLowerCase();
      hit=files.find(x=>path.posix.basename(x.path).toLowerCase()===base&&/More Bar Transmutations/i.test(x.path));
    }
    if(!hit)return res.status(404).json({ok:false,error:'file not found',wanted,files:files.map(x=>x.path).slice(0,100)});
    const text=fs.readFileSync(hit.full,'utf8');
    return res.json({ok:true,modId,fileId,path:hit.path,text});
  }catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)});}
  finally{if(tmp)try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}}
};
