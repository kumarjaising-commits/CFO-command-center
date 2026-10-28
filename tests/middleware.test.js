// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// middleware.js is an ES module for Vercel; load a copy as .mjs
async function load() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-'));
  const file = path.join(dir, 'middleware.mjs');
  fs.copyFileSync(path.join(__dirname, '..', 'middleware.js'), file);
  return (await import(file)).default;
}
const req = (auth) => new Request('https://example.test/', { headers: auth ? { authorization: auth } : {} });
const basic = (user, pass) => 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');

test('asks for a password, and lets the right one through', async () => {
  const mw = await load();
  process.env.SITE_PASSWORD = 'test-password';
  const none = mw(req());
  assert.equal(none.status, 401);
  assert.match(none.headers.get('www-authenticate'), /^Basic realm=/);
  assert.equal(mw(req(basic('anyone', 'wrong'))).status, 401);
  assert.equal(mw(req(basic('anyone', 'test-password '))).status, 401);
  assert.equal(mw(req('Bearer test-password')).status, 401);
  assert.equal(mw(req('Basic !!notbase64')).status, 401);
  const ok = mw(req(basic('', 'test-password')));
  assert.equal(ok.headers.get('x-middleware-next'), '1');
  assert.equal(mw(req(basic('chair', 'test-password'))).headers.get('x-middleware-next'), '1');
});

test('stays closed when no password is configured', async () => {
  const mw = await load();
  delete process.env.SITE_PASSWORD;
  assert.equal(mw(req(basic('', ''))).status, 503);
});
