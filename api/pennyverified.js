const fs=require('fs');
const path=require('path');
const os=require('os');
const {spawnSync}=require('child_process');
const {downloadMod}=require('../scripts/nexus-downloader');
const seven=require('7zip-bin').path7za;
module.exports=async function(req,res){
  let dir=null;
  try{
    const dl=await downloadMod({game:'stardewvalley',modId:'18091',fileId:'107657'});
    dir=fs.mkdtempSync(path.join(os.tmpdir(),'pennyverified-'));
    const p=spawnSync(seven,['x','-y',dl.path,`-o${dir}`],{encoding:'utf8',timeout:120000});
    if(p.status!==0)return res.status(502).json({ok:false,error:'7za failed',stderr:String(p.stderr||'').slice(-1000)});
    const files=[];function walk(d){for(const n of fs.readdirSync(d)){const f=path.join(d,n),s=fs.statSync(f);if(s.isDirectory())walk(f);else files.push(f);}}walk(dir);
    const ru=files.find(f=>/[/\\]i18n[/\\]ru\.json$/i.test(f))||files.find(f=>/ru\.json$/i.test(f));
    if(!ru)return res.status(404).json({ok:false,error:'ru.json not found',files:files.map(f=>path.relative(dir,f))});
    const b=fs.readFileSync(ru);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="penny_verified_ru.json"');res.setHeader('X-Source-Translation','18091/107657');return res.send(b);
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
  finally{if(dir)try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}
};