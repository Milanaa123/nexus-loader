'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = 5 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', body.length);
  res.end(body);
}

function installVercelResponseHelpers(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(value) {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  res.send = function send(value) {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      res.end(value);
    } else if (value !== null && typeof value === 'object') {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    } else {
      res.end(value == null ? '' : String(value));
    }
    return res;
  };
  return res;
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error('Request body too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type === 'application/json') return JSON.parse(raw);
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  return raw;
}

function queryObject(url) {
  const out = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function handleApi(req, res, url) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const match = /^\/api\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match) return sendJson(res, 404, { ok: false, error: 'API route not found' });

  const handlerPath = path.join(ROOT, 'api', `${match[1]}.js`);
  if (!fs.existsSync(handlerPath)) return sendJson(res, 404, { ok: false, error: 'API route not found' });

  req.query = queryObject(url);
  try {
    req.body = await readBody(req);
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { ok: false, error: err.message || 'Invalid request body' });
  }

  installVercelResponseHelpers(res);
  try {
    const handler = require(handlerPath);
    if (typeof handler !== 'function') return sendJson(res, 500, { ok: false, error: 'Invalid API handler' });
    await handler(req, res);
    if (!res.writableEnded) res.end();
  } catch (err) {
    if (!res.headersSent) return sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
    if (!res.writableEnded) res.end();
  }
}

function safePublicPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded === '/' || decoded === '') return path.join(ROOT, 'index.html');

  const relative = decoded.replace(/^\/+/, '');
  const first = relative.split('/')[0];
  const allowedRootFiles = new Set(['index.html', 'favicon.ico']);
  const allowedDirs = new Set(['data', 'android']);
  if (!allowedRootFiles.has(relative) && !allowedDirs.has(first)) return null;

  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(path.resolve(ROOT) + path.sep)) return null;
  return filePath;
}

function serveStatic(req, res, url) {
  const filePath = safePublicPath(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }
  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'nexus-loader',
      runtime: 'render',
      apiKeyConfigured: Boolean(process.env.NEXUS_API_KEY)
    });
  }

  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (!['GET', 'HEAD'].includes(req.method)) return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`nexus-loader listening on http://${HOST}:${PORT}`);
});
