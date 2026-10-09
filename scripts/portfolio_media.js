// scripts/portfolio_media.js
//
// Everything the gallery of a direction page needs besides the photo itself,
// written next to each photo in data/portfolio.json and in the photo lists of
// the three site-only direction pages:
//   width, height -- the photo's size, so the rows stand before it arrives;
//   thumb         -- a 640 px wide copy for the grid (<dir>/w640/<name>.webp);
//                    the original stays for the viewer and dense screens;
//   preview       -- the photo at 16 px, inline, shown blurred while it loads.
// Run after adding or replacing a photo (needs ffmpeg on PATH, or FFMPEG=...):
//   node scripts/portfolio_media.js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const site = path.join(__dirname, '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const THUMB_WIDTH = 640;
const fileOf = url => path.join(site, url.replace(/^\/sayanmramor-site\//, ''));
const thumbOf = url => url.replace(/\/([^/]+)\.webp$/, '/w' + THUMB_WIDTH + '/$1.webp');

// Width and height from a WebP header (VP8X, VP8 or VP8L).
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(file + ': not a WebP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  throw new Error(file + ': unknown WebP chunk ' + chunk);
}

function ffmpeg(args) {
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y'].concat(args), { stdio: ['ignore', 'ignore', 'pipe'] });
}

const done = new Map();   // one photo may stand in several directions
function media(image) {
  if (done.has(image)) return done.get(image);
  const src = fileOf(image);
  const [width, height] = webpSize(src);
  const thumb = thumbOf(image);
  const thumbFile = fileOf(thumb);
  if (!fs.existsSync(thumbFile) || fs.statSync(thumbFile).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(thumbFile), { recursive: true });
    ffmpeg(['-i', src, '-vf', 'scale=' + THUMB_WIDTH + ':-2:flags=lanczos', '-c:v', 'libwebp', '-quality', '78', '-map_metadata', '-1', thumbFile]);
  }
  const tmp = path.join(require('node:os').tmpdir(), 'preview-' + process.pid + '.webp');
  ffmpeg(['-i', src, '-vf', 'scale=16:-2:flags=area', '-c:v', 'libwebp', '-quality', '40', '-map_metadata', '-1', tmp]);
  const preview = 'data:image/webp;base64,' + fs.readFileSync(tmp).toString('base64');
  fs.unlinkSync(tmp);
  const m = { width, height, thumb, preview };
  done.set(image, m);
  return m;
}

// data/portfolio.json: one item per line, as it is written by hand.
const jsonPath = path.join(site, 'data', 'portfolio.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const lines = ['{'];
Object.entries(data).forEach(([key, items], k, all) => {
  lines.push('  ' + JSON.stringify(key) + ': [');
  items.forEach((item, i) => {
    const out = Object.assign({ image: item.image, caption: item.caption }, media(item.image));
    lines.push('    { ' + Object.entries(out).map(([n, v]) => JSON.stringify(n) + ': ' + JSON.stringify(v)).join(', ') + ' }' + (i < items.length - 1 ? ',' : ''));
  });
  lines.push('  ]' + (k < all.length - 1 ? ',' : ''));
});
lines.push('}');
fs.writeFileSync(jsonPath, lines.join('\n') + '\n');

// The site-only pages: { image: '...', caption: '' ... } lines inside renderPortfolio([...]).
['spa-zony', 'hammamy', 'basseyny'].forEach(slug => {
  const page = path.join(site, 'categories', slug + '.html');
  const html = fs.readFileSync(page, 'utf8').replace(
    /\{ image: '([^']+)', caption: '([^']*)'[^}\n]*\}/g,
    (m, image, caption) => {
      const x = media(image);
      return `{ image: '${image}', caption: '${caption}', width: ${x.width}, height: ${x.height}, thumb: '${x.thumb}', preview: '${x.preview}' }`;
    });
  fs.writeFileSync(page, html);
});
console.log('ok:', done.size, 'photos');
