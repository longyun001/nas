import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { SERVICE_DEFS, DEFAULT_PREFS } from './src/core.mjs';
import config from './config.mjs';
const port = Number(process.env.PORT || 8877);
const checksEnabled = process.env.NAV_ENABLE_CHECKS === '1' && config.enableHealth;
const cache = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  if (url.pathname.startsWith('/api/health') && req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); res.end(); return; }
  if (url.pathname === '/api/health') {
    if (!checksEnabled) { res.writeHead(501); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ version: 1, source: 'pc', keys: SERVICE_DEFS.map(s => s.key) })); return;
  }
  if (url.pathname.startsWith('/api/health/')) {
    if (req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const key = url.pathname.slice('/api/health/'.length);
    const service = SERVICE_DEFS.find(s => s.key === key);
    if (!checksEnabled || !service) { res.writeHead(404); res.end(); return; }
    let result = cache.get(key);
    if (!result || Date.now() - result.at > 10000) {
      const start = performance.now();
      try {
        const probe = await fetch(`http://${DEFAULT_PREFS.lanHost}:${service.port}/`, { redirect: 'manual', signal: AbortSignal.timeout(4000) });
        result = { code: probe.status, seconds: (performance.now() - start) / 1000, at: Date.now() };
        await probe.body?.cancel();
      } catch { result = { code: 504, seconds: (performance.now() - start) / 1000, at: Date.now() }; }
      cache.set(key, result);
    }
    res.setHeader('X-NAS-Upstream-Status', String(result.code));
    res.setHeader('X-NAS-Upstream-Time', result.seconds.toFixed(3));
    res.setHeader('X-NAS-Check-From', 'pc');
    res.writeHead(200); res.end(); return;
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (!['/', '/index.html'].includes(url.pathname)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL('./dist/index.html', import.meta.url));
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Build first: node build.mjs'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/ (HTTP checks ${checksEnabled ? 'enabled, from this PC' : 'disabled'})`));
