const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const pkg = require('./package.json');
const { listProviders } = require('./providers/provider-registry');
const { listGames } = require('./lib/game-registry');
const { configurationStatus } = require('./config/storage');
require('./providers/nexus-provider');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const API_DIR = path.join(ROOT, 'api');
const MAX_BODY_BYTES = Math.max(1024, Number(process.env.MAX_BODY_BYTES || 2 * 1024 * 1024));
const ACTIVE_APIS = new Set(['status', 'packStatus', 'startFromInput', 'jobQueue', 'downloadReady', 'bulkModSearch']);

function attachResponseHelpers(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.status = function status(code) { res.statusCode = code; return res; };
  res.json = function json(value) {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
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
  const output = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(output, key)) output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
    else output[key] = value;
  }
  return output;
}

async function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (type === 'application/json') {
    try { return JSON.parse(raw || '{}'); }
    catch (_) { const error = new Error('Invalid JSON body'); error.statusCode = 400; throw error; }
  }
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function sendIndex(res) {
  const file = path.join(ROOT, 'index.html');
  fs.readFile(file, (error, data) => {
    if (error) return res.status(500).json({ ok: false, error: 'index_unavailable' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  });
}

async function runApi(req, res, apiName) {
  if (!/^[a-z0-9_-]+$/i.test(apiName) || !ACTIVE_APIS.has(apiName)) return res.status(404).json({ ok: false, error: 'api_not_found' });
  const file = path.join(API_DIR, `${apiName}.js`);
  if (!file.startsWith(`${API_DIR}${path.sep}`) || !fs.existsSync(file)) return res.status(404).json({ ok: false, error: 'api_handler_not_found' });
  delete require.cache[require.resolve(file)];
  const handler = require(file);
  if (typeof handler !== 'function') return res.status(500).json({ ok: false, error: 'invalid_api_handler' });
  return handler(req, res);
}

function healthPayload() {
  return {
    ok: true,
    service: 'nexus-loader',
    version: pkg.version,
    node: process.version,
    providers: listProviders(),
    games: listGames(),
    activeApis: [...ACTIVE_APIS],
    nexusApiKeyConfigured: Boolean(process.env.NEXUS_API_KEY),
    storage: { workspace: 'local-filesystem', googleDrive: configurationStatus() }
  };
}

function createServer() {
  const server = http.createServer(async (req, rawRes) => {
    const res = attachResponseHelpers(rawRes);
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      req.query = parseQuery(url);
      req.body = await parseBody(req);
      if (url.pathname === '/health') return res.json(healthPayload());
      if (url.pathname === '/' || url.pathname === '/index.html') return sendIndex(res);
      const match = url.pathname.match(/^\/api\/([a-z0-9_-]+)\/?$/i);
      if (match) return await runApi(req, res, match[1]);
      return res.status(404).json({ ok: false, error: 'not_found' });
    } catch (error) {
      if (res.writableEnded) return;
      return res.status(error.statusCode || 500).json({ ok: false, error: error.message || 'internal_server_error' });
    }
  });
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;
  server.requestTimeout = 130000;
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => console.log(`nexus-loader ${pkg.version} listening on http://${HOST}:${PORT}`));
  const shutdown = signal => {
    console.log(`Received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { ACTIVE_APIS, createServer, parseBody, healthPayload };
