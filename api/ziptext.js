const zlib = require('zlib');
const crypto = require('crypto');

const SOURCES = {
  arv: 'https://stardewmods.ru/uploads/public_files/2025-05/arvsunberry.zip',
  jorts: 'https://stardewmods.ru/uploads/public_files/2025-03/jorts-and-jean.zip'
};

function entries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP EOCD not found');
  const count = buf.readUInt16LE(eocd + 10), cdOffset = buf.readUInt32LE(eocd + 16), out=[];
  let p=cdOffset;
  for(let n=0;n<count;n++){
    if(buf.readUInt32LE(p)!==0x02014b50) throw new Error('Bad central directory');
    const flags=buf.readUInt16LE(p+8),method=buf.readUInt16LE(p+10),compressedSize=buf.readUInt32LE(p+20),uncompressedSize=buf.readUInt32LE(p+24),nameLen=buf.readUInt16LE(p+28),extraLen=buf.readUInt16LE(p+30),commentLen=buf.readUInt16LE(p+32),localOffset=buf.readUInt32LE(p+42);
    const name=buf.subarray(p+46,p+46+nameLen).toString((flags&0x800)?'utf8':'utf8');
    out.push({name,method,compressedSize,uncompressedSize,localOffset}); p+=46+nameLen+extraLen+commentLen;
  }
  return out;
}
function extract(buf,e){
  const p=e.localOffset;if(buf.readUInt32LE(p)!==0x04034b50)throw new Error('Bad local header');
  const nameLen=buf.readUInt16LE(p+26),extraLen=buf.readUInt16LE(p+28),start=p+30+nameLen+extraLen,raw=buf.subarray(start,start+e.compressedSize);
  if(e.method===0)return raw;if(e.method===8)return zlib.inflateRawSync(raw);throw new Error(`Unsupported compression method ${e.method}`);
}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
function flat(obj,p='',out={}){if(obj&&typeof obj==='object'&&!Array.isArray(obj)){for(const[k,v]of Object.entries(obj))flat(v,p?`${p}.${k}`:k,out);}else out[p]=obj;return out;}
function stripJsonc(s){
  let out='',ins=false,esc=false,line=false,block=false;
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(line){if(c==='\n'){line=false;out+=c;}continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}else if(c==='\n')out+='\n';continue;}
    if(ins){out+=c;if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')ins=false;continue;}
    if(c==='"'){ins=true;out+=c;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    out+=c;
  }
  return out.replace(/,\s*([}\]])/g,'$1');
}
function parseJson(b){let s=b.toString('utf8').replace(/^\uFEFF/,'');try{return JSON.parse(s);}catch{return JSON.parse(stripJsonc(s));}}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const source=String(req.query.source||''),url=SOURCES[source];if(!url)return res.status(400).json({ok:false,error:'source must be arv or jorts'});
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)return res.status(502).json({ok:false,error:'source fetch failed',status:r.status});
    const buf=Buffer.from(await r.arrayBuffer()),list=entries(buf).filter(e=>!e.name.endsWith('/')),mode=String(req.query.mode||'');
    if(mode==='hashes'){const files=list.map(e=>{const b=extract(buf,e);return{name:e.name,size:b.length,sha256:sha(b)};});return res.json({ok:true,source,sizeBytes:buf.length,files});}
    if(mode==='cyrfiles'){
      const files=[];
      for(const e of list){
        if(!/\.(json|tmx|txt|md)$/i.test(e.name)) continue;
        const b=extract(buf,e),s=b.toString('utf8'),m=s.match(/[А-Яа-яЁё]/g);
        if(m&&m.length) files.push({name:e.name,size:b.length,cyrillicChars:m.length,sha256:sha(b)});
      }
      return res.json({ok:true,source,files});
    }
    if(mode==='audit'){
      const def=list.find(e=>/\/i18n\/default\.json$/i.test(e.name)),ru=list.find(e=>/\/i18n\/ru\.json$/i.test(e.name));if(!def||!ru)return res.status(404).json({ok:false,error:'default/ru i18n pair not found'});
      const db=extract(buf,def),rb=extract(buf,ru),d=flat(parseJson(db)),u=flat(parseJson(rb)),dk=Object.keys(d),uk=Object.keys(u),us=new Set(uk),ds=new Set(dk),missing=dk.filter(k=>!us.has(k)),extra=uk.filter(k=>!ds.has(k)),same=dk.filter(k=>us.has(k)&&typeof d[k]==='string'&&d[k]===u[k]);
      return res.json({ok:true,source,defaultPath:def.name,ruPath:ru.name,defaultSha256:sha(db),ruSha256:sha(rb),defaultKeys:dk.length,ruKeys:uk.length,missingCount:missing.length,extraCount:extra.length,sameCount:same.length,missing:missing.slice(0,200),extra:extra.slice(0,200),same:same.slice(0,200)});
    }
    const wanted=req.query.path?String(req.query.path):null;if(!wanted)return res.json({ok:true,source,sizeBytes:buf.length,files:list.map(e=>({name:e.name,size:e.uncompressedSize}))});
    const e=list.find(x=>x.name===wanted);if(!e)return res.status(404).json({ok:false,error:'entry not found'});if(e.uncompressedSize>4500000)return res.status(413).json({ok:false,error:'entry too large',size:e.uncompressedSize});
    const data=extract(buf,e);return res.json({ok:true,source,path:e.name,size:data.length,sha256:sha(data),text:data.toString('utf8')});
  }catch(err){return res.status(500).json({ok:false,error:String(err&&err.message||err)});}
};
