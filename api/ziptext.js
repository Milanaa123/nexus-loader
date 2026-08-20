const zlib = require('zlib');
const crypto = require('crypto');

const SOURCES = {
  arv: 'https://stardewmods.ru/uploads/public_files/2025-05/arvsunberry.zip',
  jorts: 'https://stardewmods.ru/uploads/public_files/2025-03/jorts-and-jean.zip'
};

function entries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP EOCD not found');
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const out = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    out.push({name, method, compressedSize, uncompressedSize, localOffset});
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function extract(buf, e) {
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Bad local header');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return raw;
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Unsupported compression method ${e.method}`);
}
function sha(b){ return crypto.createHash('sha256').update(b).digest('hex'); }
function flat(obj,p='',out={}){
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k,v] of Object.entries(obj)) flat(v,p?`${p}.${k}`:k,out);
  } else out[p]=obj;
  return out;
}
function parseJson(b){ return JSON.parse(b.toString('utf8').replace(/^\uFEFF/,'')); }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const source = String(req.query.source || '');
    const url = SOURCES[source];
    if (!url) return res.status(400).json({ok:false,error:'source must be arv or jorts'});
    const r = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0'}});
    if (!r.ok) return res.status(502).json({ok:false,error:'source fetch failed',status:r.status});
    const buf = Buffer.from(await r.arrayBuffer());
    const list = entries(buf).filter(e => !e.name.endsWith('/'));
    const mode = String(req.query.mode || '');
    if (mode === 'hashes') {
      const files = list.map(e => { const b=extract(buf,e); return {name:e.name,size:b.length,sha256:sha(b)}; });
      return res.json({ok:true,source,sizeBytes:buf.length,files});
    }
    if (mode === 'audit') {
      const def = list.find(e => /\/i18n\/default\.json$/i.test(e.name));
      const ru = list.find(e => /\/i18n\/ru\.json$/i.test(e.name));
      if (!def || !ru) return res.status(404).json({ok:false,error:'default/ru i18n pair not found'});
      const db=extract(buf,def), rb=extract(buf,ru);
      const d=flat(parseJson(db)), u=flat(parseJson(rb));
      const dk=Object.keys(d), uk=Object.keys(u), us=new Set(uk), ds=new Set(dk);
      const missing=dk.filter(k=>!us.has(k));
      const extra=uk.filter(k=>!ds.has(k));
      const same=dk.filter(k=>us.has(k) && typeof d[k]==='string' && d[k]===u[k]);
      return res.json({ok:true,source,defaultPath:def.name,ruPath:ru.name,defaultSha256:sha(db),ruSha256:sha(rb),defaultKeys:dk.length,ruKeys:uk.length,missingCount:missing.length,extraCount:extra.length,sameCount:same.length,missing:missing.slice(0,200),extra:extra.slice(0,200),same:same.slice(0,200)});
    }
    const wanted = req.query.path ? String(req.query.path) : null;
    if (!wanted) return res.json({ok:true,source,sizeBytes:buf.length,files:list.map(e=>({name:e.name,size:e.uncompressedSize}))});
    const e = list.find(x => x.name === wanted);
    if (!e) return res.status(404).json({ok:false,error:'entry not found'});
    if (e.uncompressedSize > 4500000) return res.status(413).json({ok:false,error:'entry too large',size:e.uncompressedSize});
    const data = extract(buf,e);
    return res.json({ok:true,source,path:e.name,size:data.length,sha256:sha(data),text:data.toString('utf8')});
  } catch (err) {
    return res.status(500).json({ok:false,error:String(err && err.message || err)});
  }
};
