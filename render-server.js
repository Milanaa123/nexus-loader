const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
require('./scripts/download-cached-translations');
require('./scripts/pkg50-startup-audit');
require('./scripts/missing537-startup');
require('./scripts/missing537-final-audit');
require('./scripts/export-rar-ru');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const API_DIR = path.join(ROOT, 'api');
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function attachResponseHelpers(res) {
  res.status = function status(code) { res.statusCode = code; return res; };
  res.json = function json(value) { if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); return res; };
  res.send = function send(value) {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) { res.end(value); return res; }
    if (value !== null && typeof value === 'object') return res.json(value);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(value == null ? '' : String(value));
    return res;
  };
  return res;
}

function parseQuery(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    else out[key] = value;
  }
  return out;
}

async function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { const err = new Error('Request body too large'); err.statusCode = 413; throw err; }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (type === 'application/json') return JSON.parse(raw || '{}');
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function sendIndex(res) {
  const file = path.join(ROOT, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return res.status(500).json({ ok: false, error: 'index.html unavailable' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(data);
  });
}

async function runApi(req, res, apiName) {
  if (!/^[a-z0-9_-]+$/i.test(apiName)) return res.status(404).json({ ok: false, error: 'Not found' });
  const file = path.join(API_DIR, `${apiName}.js`);
  if (!file.startsWith(API_DIR + path.sep) || !fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'API handler not found' });
  delete require.cache[require.resolve(file)];
  const handler = require(file);
  if (typeof handler !== 'function') return res.status(500).json({ ok: false, error: 'Invalid API handler' });
  return handler(req, res);
}

function nexusHeaders() {
  return { 'Content-Type':'application/json', 'APIKEY':process.env.NEXUS_API_KEY, 'User-Agent':'nexus-loader/2.3', 'Application-Name':'nexus-loader', 'Application-Version':'2.3' };
}

async function nexusSelfTest() {
  const key = process.env.NEXUS_API_KEY;
  if (!key) { console.log('NEXUS SELFTEST key=missing'); return; }
  const headers = nexusHeaders();
  try {
    const vr = await fetch('https://api.nexusmods.com/v1/users/validate.json', { headers });
    const vd = await vr.json().catch(() => ({}));
    console.log(`NEXUS SELFTEST validate=${vr.ok?'ok':'fail'} status=${vr.status} premium=${Boolean(vd.is_premium)}`);
  } catch (e) { console.log('NEXUS SELFTEST validate=error '+e.message); }
  try {
    delete require.cache[require.resolve('./api/generateIds')];
    const idResolver=require('./api/generateIds');
    for(const test of [
      {name:'(CP) Content Patcher',author:'Pathoschild',expected:'1915'},
      {name:'Stardew Valley Expanded',author:'FlashShifter',expected:'3753'},
      {name:'Tractor Mod',author:'Pathoschild',expected:'1401'}
    ]){
      try{ const id=await idResolver.searchMod(test); console.log(`NEXUS SELFTEST id-resolver=${JSON.stringify(test.name)} result=${id||'none'} expected=${test.expected} pass=${String(id||'')===test.expected}`); }
      catch(e){ console.log(`NEXUS SELFTEST id-resolver=${JSON.stringify(test.name)} pass=false error=${e.message}`); }
    }
  }catch(e){console.log('NEXUS SELFTEST id-resolver-load error='+e.message);}
}

const server = http.createServer(async (req, rawRes) => {
  const res = attachResponseHelpers(rawRes);
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    req.query = parseQuery(url); req.body = await parseBody(req);
    if (url.pathname === '/health') return res.json({ ok:true, service:'nexus-loader', runtime:'render-compatible', nexusApiKeyConfigured:Boolean(process.env.NEXUS_API_KEY) });
    if (url.pathname === '/' || url.pathname === '/index.html') return sendIndex(res);
    const match = url.pathname.match(/^\/api\/([a-z0-9_-]+)\/?$/i);
    if (match) return await runApi(req, res, match[1]);
    return res.status(404).json({ ok:false, error:'Not found' });
  } catch (err) {
    if (res.writableEnded) return;
    return res.status(err.statusCode || 500).json({ ok:false, error:err.message || 'Internal server error' });
  }
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.listen(PORT, HOST, () => {
  console.log(`nexus-loader listening on http://${HOST}:${PORT}`);
  nexusSelfTest().catch(e=>console.log('NEXUS SELFTEST fatal '+e.message));
  setTimeout(async()=>{
    try {
      console.log('TRACTOR_EXPORT_BEGIN');
      const r=await fetch(`http://127.0.0.1:${PORT}/api/tractor`,{signal:AbortSignal.timeout(120000)});
      const b=Buffer.from(await r.arrayBuffer());
      const sha=crypto.createHash('sha256').update(b).digest('hex');
      if(!r.ok || b[0]!==0x50 || b[1]!==0x4b){
        console.log(`TRACTOR_EXPORT_ERROR|status=${r.status}|bytes=${b.length}|sample=${b.subarray(0,300).toString('utf8')}`);
        return;
      }
      const s=b.toString('base64'); const N=40000; const count=Math.ceil(s.length/N);
      console.log(`TRACTOR_META|status=${r.status}|bytes=${b.length}|sha256=${sha}|chunks=${count}`);
      for(let i=0;i<count;i++) console.log(`TRACTOR_B64|${String(i+1).padStart(2,'0')}|${s.slice(i*N,(i+1)*N)}`);
      console.log('TRACTOR_EXPORT_DONE');
    } catch(e) { console.log('TRACTOR_EXPORT_FATAL|'+String(e&&e.stack||e)); }
  },5000);
});
