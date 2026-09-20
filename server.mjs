import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ...['app', 'parser', 'capture', 'samples'].map(name => [`/${name}.js`, [`${name}.js`, 'text/javascript; charset=utf-8']]),
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);
export function createAppServer() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    // Limit both network binding and Host; reject non-loopback DNS aliases.
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) { res.writeHead(403).end('Local access only'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const asset = assets.get(req.url);
    if (!asset) { res.writeHead(404).end('Not found'); return; }
    try {
      const body = await readFile(new URL(`./public/${asset[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': asset[1], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500).end('Unable to load app asset'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a number between 1 and 65535.'); process.exitCode = 1;
  } else {
    const server = createAppServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Try PORT=4174 npm start.` : `Could not start local server (${error.code}).`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`\n  Magstripe Lab → http://127.0.0.1:${port}\n  Offline · Local only · Ctrl+C to stop\n`));
  }
}
