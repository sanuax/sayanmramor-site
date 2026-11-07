// scripts/stamp_assets.js -- every page's own stylesheets and classic scripts carry
// ?v=<the first 8 hex of the file's sha256>, so a browser that keeps its copy past
// GitHub Pages' 10 minutes (Telegram's in-app browser, 2026-10-19) still fetches a file
// once it has changed. Run after editing anything in css/ or js/:
//   node scripts/stamp_assets.js
// tests/site.test.js fails while a stamp is stale.
// The showroom's ES modules (js/showroom/) import each other by plain relative URLs, so
// a stamp on the page's link alone would not reach them: the showroom page carries an
// import map (between the IMPORTMAP markers) that sends every module's plain URL to its
// stamped one, and its modulepreload links and the entry script use the same stamped
// URLs (2026-11-08: a phone kept the old modules after an update and the new page's
// light switch did nothing).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const site = path.join(__dirname, '..');
const ASSET = /((?:href|src)="\/sayanmramor-site\/)((?:css|js)\/[\w./-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g;
const IMPORTMAP = /(<!-- IMPORTMAP -->\n)[^]*?(\n<!-- \/IMPORTMAP -->)/;

const pages = () => [
  ...fs.readdirSync(site).filter(f => f.endsWith('.html')),
  ...fs.readdirSync(path.join(site, 'categories')).filter(f => f.endsWith('.html')).map(f => 'categories/' + f),
];
const stampOf = file => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(site, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 8);
// The showroom's ES modules: every file in js/showroom/ written as a module.
const modules = () => fs.readdirSync(path.join(site, 'js', 'showroom')).filter(f => f.endsWith('.js'))
  .map(f => 'js/showroom/' + f).filter(f => /^(?:import|export) /m.test(fs.readFileSync(path.join(site, f), 'utf8'))).sort();
const importMap = () => '<script type="importmap">' + JSON.stringify({
  imports: Object.fromEntries(modules().map(f => ['/sayanmramor-site/' + f, '/sayanmramor-site/' + f + '?v=' + stampOf(f)])),
}) + '</script>';
const stamped = html => html.replace(ASSET, (m, head, file) => head + file + '?v=' + stampOf(file) + '"')
  .replace(IMPORTMAP, (m, open, close) => open + importMap() + close);

if (require.main === module) {
  pages().forEach(page => {
    const file = path.join(site, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = stamped(html);
    if (next !== html) { fs.writeFileSync(file, next); console.log('stamped', page); }
  });
}

module.exports = { pages, stampOf, stamped, modules, importMap, ASSET };
