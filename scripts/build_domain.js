#!/usr/bin/env node
// Builds the site + the configurator for the own domain (reg.ru hosting):
// the site at the root, the configurator at /studio/ (its page becomes studio/index.html).
// The sources stay as they are (GitHub Pages paths /sayanmramor-site/ and
// /sayanmramor-calculator/); every address is rewritten here, in the copy.
//
//   node scripts/build_domain.js --site <site tree> --calc <calculator tree> --out <dir>
//
// scripts/deploy_regru.sh feeds it the published trees (git archive of origin/master and
// origin/rate-catalog-subcategories). See docs/move-to-hosting.md.
'use strict';
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://sayanmramor.ru';
// Bump when the rewriting below changes: own CSS/JS are cached for a year by ?v=<hash>,
// and the hash is of the source, so a build-only change needs a new tail.
const BUILD_TAIL = 'd1';

const SITE_SKIP = new Set(['.gitignore', '.claude', '.superpowers', '.impeccable', '.worktrees', 'node_modules',
  'docs', 'scripts', 'tests', 'server', 'deploy', 'package.json', 'package-lock.json']);
const CALC_SKIP = new Set(['.gitignore', '.claude', '.superpowers', '.worktrees', 'node_modules', '__pycache__',
  'docs', 'scripts', 'tests', 'backups', 'package.json', 'package-lock.json']);
const TEXT = /\.(html|js|mjs|css|json|xml|txt|webmanifest)$/i;

// Order matters: the longest forms first.
const REWRITES = [
  ['https://sanuax.github.io/sayanmramor-site/', ORIGIN + '/'],
  ['/sayanmramor-calculator/sayanmramor-calculator.html', '/studio/'],
  ['/sayanmramor-calculator/', '/studio/'],
  ['/sayanmramor-site/index.html', '/'],
  ['/sayanmramor-site/', '/'],
];
// Addresses only: the names also stand in code comments and in the request's `source` label.
const LEFTOVER = /\/sayanmramor-(site|calculator)\/|sanuax\.github\.io|["'`]sayanmramor-calculator\.html/;

// Pages for sitemap.xml (podborka.html is someone's own list: noindex, not listed).
const PAGES = ['', 'kamen.html', 'katalog.html', 'showroom.html', 'studio/', 'privacy.html'];

function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const o = { site: get('--site'), calc: get('--calc'), out: get('--out') };
  if (!o.site || !o.calc || !o.out) {
    console.error('usage: build_domain.js --site <dir> --calc <dir> --out <dir>');
    process.exit(2);
  }
  return o;
}

function copyTree(from, to, skip) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (skip.has(name) || /\.md$/i.test(name)) continue; // notes and handoffs at the root are not for visitors
    fs.cpSync(path.join(from, name), path.join(to, name), { recursive: true });
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function pageUrl(out, file) {
  let rel = path.relative(out, file).split(path.sep).join('/');
  if (rel === 'index.html') rel = '';
  if (rel === 'studio/index.html') rel = 'studio/';
  return ORIGIN + '/' + rel;
}

function fixHead(html, url, file) {
  // GitHub Pages copy is closed to search engines; the domain is open.
  html = html.replace(/[ \t]*<!-- test hosting \(GitHub Pages\)[^\n]*-->\r?\n/g, '');
  html = html.replace(/[ \t]*<meta name="robots" content="noindex, nofollow" data-test-hosting>\r?\n/g, '');
  const ownNoindex = /<meta name="robots" content="noindex/.test(html);
  if (!ownNoindex && !/<link rel="canonical"/.test(html)) {
    const at = html.indexOf('<link rel="icon"');
    if (at < 0) throw new Error('no <link rel="icon"> to put canonical before: ' + file);
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    html = html.slice(0, at) + '<link rel="canonical" href="' + url + '">' + eol + html.slice(at);
  }
  return html;
}

function main() {
  const o = args();
  const out = path.resolve(o.out);
  fs.rmSync(out, { recursive: true, force: true });
  copyTree(o.site, out, SITE_SKIP);
  copyTree(o.calc, path.join(out, 'studio'), CALC_SKIP);
  fs.renameSync(path.join(out, 'studio', 'sayanmramor-calculator.html'), path.join(out, 'studio', 'index.html'));
  // lead.php runs only on the hosting, never on GitHub Pages: take this repo's own copy
  // (next to this script), like deploy/.
  fs.copyFileSync(path.join(__dirname, '..', 'server', 'lead.php'), path.join(out, 'lead.php'));
  // browsers ask for /favicon.ico on their own, whatever the pages link
  fs.copyFileSync(path.join(out, 'assets', 'brand', 'favicon.ico'), path.join(out, 'favicon.ico'));
  // .htaccess and search verification files: this repo's own deploy/ (next to this script).
  const deploy = path.join(__dirname, '..', 'deploy');
  fs.copyFileSync(path.join(deploy, 'htaccess'), path.join(out, '.htaccess'));
  for (const f of fs.readdirSync(deploy)) if (/^yandex_.*\.html$|^google.*\.html$/.test(f)) fs.copyFileSync(path.join(deploy, f), path.join(out, f));

  const files = walk(out);
  let changed = 0;
  const leftovers = [];
  const pages = [];
  for (const f of files) {
    if (!TEXT.test(f) || /yandex_|google/.test(path.basename(f))) continue;
    const src = fs.readFileSync(f, 'utf8');
    let t = src;
    for (const [a, b] of REWRITES) t = t.split(a).join(b);
    t = t.replace(/\?v=([0-9a-f]{8})\b/g, '?v=$1' + BUILD_TAIL);
    if (/\.html$/i.test(f)) {
      t = fixHead(t, pageUrl(out, f), f);
      pages.push(f);
    }
    if (t !== src) { fs.writeFileSync(f, t); changed++; }
    if (LEFTOVER.test(t)) leftovers.push(path.relative(out, f));
  }

  const cats = fs.readdirSync(path.join(out, 'categories')).filter((n) => n.endsWith('.html')).sort().map((n) => 'categories/' + n);
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.slice(0, 3).concat(cats, PAGES.slice(3));
  fs.writeFileSync(path.join(out, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + ORIGIN + '/' + u + '</loc><lastmod>' + today + '</lastmod></url>').join('\n') +
    '\n</urlset>\n');
  fs.writeFileSync(path.join(out, 'robots.txt'),
    'User-agent: *\nDisallow: /lead.php\nDisallow: /podborka.html\n\nHost: ' + ORIGIN + '\nSitemap: ' + ORIGIN + '/sitemap.xml\n');

  const noindex = pages.filter((p) => /<meta name="robots" content="noindex/.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(out, p));
  console.log(`built ${out}: ${files.length + 2} files, ${changed} rewritten, ${pages.length} pages, ${urls.length} in sitemap`);
  console.log('noindex pages: ' + (noindex.join(', ') || 'none'));
  if (leftovers.length) {
    console.error('old addresses left in:\n  ' + leftovers.join('\n  '));
    process.exit(1);
  }
}

main();
