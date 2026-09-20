import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../server.mjs';

test('local static server serves only app assets and rejects writes', async t => {
  const server = createAppServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const get = (path, options = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, ...options }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  const index = await get('/');
  assert.equal(index.status, 200); assert.match(index.body, /Magstripe Lab/);
  assert.equal(index.headers['cache-control'], 'no-store');
  assert.match(index.headers['content-security-policy'], /connect-src 'none'/);
  assert.match(index.headers['content-security-policy'], /form-action 'none'/);
  for (const path of ['/app.js', '/capture.js', '/parser.js', '/samples.js', '/style.css', '/favicon.svg']) assert.equal((await get(path)).status, 200);
  for (const path of ['/../package.json', '/.git/config', '/package.json', '/?swipe=test', '/unknown']) assert.equal((await get(path)).status, 404);
  assert.equal((await get('/', { method: 'POST' })).status, 405);
  assert.equal((await get('/', { headers: { Host: 'example.com' } })).status, 403);
  assert.equal((await get('/', { method: 'HEAD' })).body, '');
});
