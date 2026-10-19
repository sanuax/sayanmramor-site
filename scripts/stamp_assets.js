// scripts/stamp_assets.js -- every page's own stylesheets and classic scripts carry
// ?v=<the first 8 hex of the file's sha256>, so a browser that keeps its copy past
// GitHub Pages' 10 minutes (Telegram's in-app browser, 2026-10-19) still fetches a file
// once it has changed. Run after editing anything in css/ or js/:
//   node scripts/stamp_assets.js
// tests/site.test.js fails while a stamp is stale. Not the showroom's ES modules
// (js/showroom/): their modulepreload links must match the imports' own URLs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const site = path.join(__dirname, '..');
const ASSET = /((?:href|src)="\/sayanmramor-site\/)((?:css|js)\/(?!showroom\/)[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g;

const pages = () => [
  ...fs.readdirSync(site).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(site, 'categories')).filter(f => f.endsWith('.html')).map(f => 'categories/' + f),
];
const stampOf = file => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(site, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
const stamped = html => html.replace(ASSET, (m, head, file) => head + file + '?v=' + stampOf(file) + '"');

if (require.main === module) {
  pages().forEach(page => {
    const file = path.join(site, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = stamped(html);
    if (next !== html) { fs.writeFileSync(file, next); console.log('stamped', page); }
  });
}

module.exports = { pages, stampOf, stamped, ASSET };
