const fs=require('fs');
const path=require('path');
const os=require('os');
const {execFileSync}=require('child_process');
const {path7za}=require('7zip-bin');
const unrar=require('node-unrar-js');

const SRC={
  orange:{modId:26723,fileId:108562,expect:1,type:'7z'},
  secret:{modId:48797,fileId:174029,expect:3,type:'rar',rarPath:'SecretNoteFramework/i18n/ru.json'}
};
async function download(x){
  const u=`https://nexus-loader.vercel.app/api/nexus?action=proxyDownload&game=stardewvalley&modId=${x.modId}&fileId=${x.fileId}`;
  const r=await fetch(u,{headers:{'User-Agent':'nexus-loader/2.0'}});
  if(!r.ok)throw new Error(`proxyDownload ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
function parse(s){return JSON.parse(s.replace(/^\uFEFF/,''));}
function cyr(s){return /[А-Яа-яЁё]/.test(s);}
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else out.push(p)}return out;}
function from7z(buf,expect){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'s47r-'));
  try{
    const arc=path.join(tmp,'src.7z'),dir=path.join(tmp,'out');fs.mkdirSync(dir);fs.writeFileSync(arc,buf);
    execFileSync(path7za,['x',arc,`-o${dir}`,'-y'],{stdio:'pipe',timeout:30000});
    for(const p of walk(dir).filter(p=>/\.json$/i.test(p))){const s=fs.readFileSync(p,'utf8');try{if(Object.keys(parse(s)).length===expect&&cyr(s))return {sourcePath:path.relative(dir,p).split(path.sep).join('/'),text:s}}catch{}}
    throw new Error('matching JSON not found in 7z');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
async function fromRar(buf,x){
  const data=Uint8Array.from(buf).buffer;
  const extractor=await unrar.createExtractorFromData({data});
  const result=extractor.extract({files:[x.rarPath]});
  const files=[...result.files];
  if(!files.length||!files[0].extraction)throw new Error('RAR target not extracted');
  const text=Buffer.from(files[0].extraction).toString('utf8');
  if(Object.keys(parse(text)).length!==x.expect||!cyr(text))throw new Error('RAR RU validation failed');
  return {sourcePath:files[0].fileHeader.name,text};
}
module.exports=async function handler(req,res){try{const key=String(req.query.source||''),x=SRC[key];if(!x)return res.status(400).json({ok:false,error:'source must be orange or secret'});const buf=await download(x);const got=x.type==='rar'?await fromRar(buf,x):from7z(buf,x.expect);const obj=parse(got.text);return res.json({ok:true,source:key,modId:x.modId,fileId:x.fileId,archiveBytes:buf.length,sourcePath:got.sourcePath,keys:Object.keys(obj).length,obj});}catch(e){return res.status(500).json({ok:false,error:String(e&&e.message||e)})}};
