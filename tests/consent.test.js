// tests/consent.test.js -- the cookie notice (js/consent.js): asked once per browser, on every page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Consent = require('../js/consent.js');
const { pages } = require('../scripts/stamp_assets.js');

const site = path.join(__dirname, '..');
function store(throws) {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { if (throws) throw new Error('full'); data[k] = String(v); },
    data,
  };
}

test('a new browser has not accepted; «Принять» is remembered in localStorage', () => {
  const win = { localStorage: store(), sessionStorage: store() };
  assert.equal(Consent.accepted(win), false);
  assert.equal(Consent.remember(win, Date.UTC(2026, 10, 8)), true);
  assert.equal(Consent.accepted(win), true);
  assert.deepEqual(JSON.parse(win.localStorage.data[Consent.KEY]), { v: Consent.VERSION, at: '2026-11-08T00:00:00.000Z' });
});

test('an older version of the answer asks again', () => {
  const win = { localStorage: store(), sessionStorage: store() };
  win.localStorage.setItem(Consent.KEY, JSON.stringify({ v: '0' }));
  assert.equal(Consent.accepted(win), false);
});

test('no localStorage: the answer holds in this tab', () => {
  const win = { localStorage: store(true), sessionStorage: store() };
  assert.equal(Consent.remember(win), true);
  assert.equal(Consent.accepted(win), true);
});

test('every page loads the notice once, after the header', () => {
  pages().forEach(page => {
    const html = fs.readFileSync(path.join(site, page), 'utf8');
    const at = html.indexOf('/js/consent.js');
    assert.ok(at > 0 && at === html.lastIndexOf('/js/consent.js'), page);
    assert.ok(html.indexOf('/js/header.js') < at, page);
  });
});

test('the notice links the policy and uses no long dash', () => {
  const src = fs.readFileSync(path.join(site, 'js/consent.js'), 'utf8');
  assert.equal(Consent.POLICY, '/sayanmramor-site/privacy.html');
  assert.ok(fs.existsSync(path.join(site, 'privacy.html')));
  assert.doesNotMatch(src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'), /—/);
});
