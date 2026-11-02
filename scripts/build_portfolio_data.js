// scripts/build_portfolio_data.js -- js/portfolio/<direction>.js from data/portfolio.json, its one source.
// A direction page reads its own photos from that script at once, right under its photo block, so
// the rows stand at their size before the page below them is drawn (2026-11-02: the page jumped
// while portfolio.json was on its way). Run after editing data/portfolio.json, then stamp the pages:
//   node scripts/build_portfolio_data.js && node scripts/stamp_assets.js
// tests/portfolio.test.js fails while they disagree.
const fs = require('fs');
const path = require('path');

const site = path.join(__dirname, '..');
const SOURCE = path.join(site, 'data', 'portfolio.json');
const DIR = path.join(site, 'js', 'portfolio');

function build(key, items) {
  return '// js/portfolio/' + key + '.js -- made by scripts/build_portfolio_data.js from data/portfolio.json; do not edit.\n'
    + '(window.SitePortfolio = window.SitePortfolio || {})[' + JSON.stringify(key) + '] = ' + JSON.stringify(items) + ';\n';
}

if (require.main === module) {
  const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  fs.mkdirSync(DIR, { recursive: true });
  Object.keys(data).forEach(key => {
    const file = path.join(DIR, key + '.js');
    const next = build(key, data[key]);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== next) { fs.writeFileSync(file, next); console.log('wrote js/portfolio/' + key + '.js'); }
  });
}

module.exports = { build, SOURCE, DIR };
