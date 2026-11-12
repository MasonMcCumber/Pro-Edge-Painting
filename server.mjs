// Production server for hosts other than Vercel (e.g. Railway).
// Serves the built Vite app from dist/ (with SPA fallback, like vercel.json's rewrite)
// and runs the same /api/lead handler Vercel runs as a serverless function.
// No extra dependencies: plain node:http.
//
//   npm run build && npm start      (listens on $PORT, default 3000)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import leadHandler from './api/lead.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 64 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

// Give the handler the small slice of Vercel's req/res helpers it uses.
function vercelRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

async function handleApi(req, res) {
  vercelRes(res);
  try {
    if (req.method === 'POST') {
      const raw = await readBody(req);
      const type = String(req.headers['content-type'] || '');
      if (!raw) req.body = {};
      else if (type.includes('application/json')) {
        try {
          req.body = JSON.parse(raw);
        } catch {
          return res.status(400).json({ error: 'Invalid request' });
        }
      } else req.body = raw; // handler parses strings itself
    }
    await leadHandler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(err.status || 500).json({ error: 'Server error' });
  }
}

async function sendFile(res, file, method) {
  const info = await stat(file).catch(() => null);
  if (!info || !info.isFile()) return false;
  const ext = extname(file).toLowerCase();
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', info.size);
  // Vite fingerprints everything in /assets, so it can be cached for good.
  res.setHeader(
    'Cache-Control',
    file.includes(`${join(ROOT, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
  );
  if (method === 'HEAD') res.end();
  else res.end(await readFile(file));
  return true;
}

async function handleStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.statusCode = 400;
    return res.end('Bad request');
  }
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end();
  }
  if (path !== '/' && (await sendFile(res, file, req.method))) return;
  // vercel.json "cleanUrls": /quote-page serves quote-page.html
  if (path !== '/' && !extname(path) && (await sendFile(res, `${file}.html`, req.method))) return;
  // SPA fallback: every other path gets index.html (same as vercel.json's rewrite).
  if (!(await sendFile(res, join(ROOT, 'index.html'), req.method))) {
    res.statusCode = 500;
    res.end('Build missing: run npm run build');
  }
}

createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const { pathname } = new URL(req.url, 'http://x');
  if (pathname === '/api/lead' || pathname === '/api/lead/') return handleApi(req, res);
  return handleStatic(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Listening on :${PORT}`));
