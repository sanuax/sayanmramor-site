// tests/dev-server.test.js
//
// The local topology contract (README, «Локальный запуск»): one origin,
// /sayanmramor-site/ -> this repository, /calculator/ -> the configurator
// checkout given to scripts/dev_server.py. Runs the real script against a
// throwaway calculator folder; skipped when Python is not installed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const PYTHON = ['python', 'python3', 'py'].find(cmd => {
  try { return spawnSync(cmd, ['--version']).status === 0; } catch (e) { return false; }
});

function get(port, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: url }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, cache: res.headers['cache-control'], clear: res.headers['clear-site-data'], body }));
    }).on('error', reject);
  });
}

async function waitFor(port) {
  for (let i = 0; i < 50; i++) {
    try { return await get(port, '/sayanmramor-site/index.html'); } catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start');
}

test('dev_server.py serves the site and the given configurator checkout on one origin', { skip: !PYTHON && 'no python' }, async () => {
  const calc = fs.mkdtempSync(path.join(os.tmpdir(), 'sayan-calc-'));
  fs.writeFileSync(path.join(calc, 'sayanmramor-calculator.html'), 'CALCULATOR-UNDER-TEST');
  fs.mkdirSync(path.join(calc, 'data'));
  fs.writeFileSync(path.join(calc, 'data', 'slabs.json'), '{"stones":[]}');
  const port = 18000 + Math.floor(Math.random() * 1000);
  const server = spawn(PYTHON, [path.join(__dirname, '..', 'scripts', 'dev_server.py'), '--port', String(port), '--calculator', calc], { stdio: 'ignore' });
  try {
    const home = await waitFor(port);
    assert.equal(home.status, 200);
    assert.match(home.body, /<html/i);

    const calculator = await get(port, '/calculator/sayanmramor-calculator.html?product=stoleshnitsa_kuhnya&stone=delicato-brown');
    assert.equal(calculator.status, 200);
    assert.equal(calculator.body, 'CALCULATOR-UNDER-TEST', '/calculator/ is the checkout passed in, nothing else');
    assert.equal((await get(port, '/calculator/data/slabs.json')).status, 200);
    assert.equal((await get(port, '/sayanmramor-site/showroom.html')).status, 200);

    const root = await get(port, '/');
    assert.equal(root.status, 302);
    assert.equal(root.location, '/sayanmramor-site/index.html');
    assert.equal(root.clear, '"cache"', 'the entry point evicts pages cached from an older local server');
    assert.equal(calculator.cache, 'no-store');
    assert.equal(calculator.clear, undefined, 'a page never clears the cache under its own downloads');

    // Nothing outside the two mounts, and no way out of them.
    assert.equal((await get(port, '/README.md')).status, 404);
    assert.equal((await get(port, '/calculator/..%2F..%2F..%2FWindows%2Fwin.ini')).status, 404);
    assert.equal((await get(port, '/calculator/C:%5CWindows%5Cwin.ini')).status, 404);
  } finally {
    server.kill();
    fs.rmSync(calc, { recursive: true, force: true });
  }
});
