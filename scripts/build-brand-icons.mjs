import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the supplied Sharp module path when it is provided by a bundled runtime.
const require = createRequire(import.meta.url);
const sharp = require(process.env.GASTROGLOBE_SHARP_PATH || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = path.join(root, 'assets/brand');
const mark = await readFile(path.join(brand, 'gastroglobe-mark.svg'), 'utf8');
const favicon = await readFile(path.join(brand, 'favicon.svg'), 'utf8');
const markBody = mark.match(/<path[\s\S]*\/>/)[0];
const iconBody = favicon.match(/<rect[\s\S]*\/>/)[0];

// A hand-hinted 16px fork uses whole pixels instead of resampling narrow tines.
const micro = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#efeae0"/><path fill="#23201b" fill-rule="evenodd" d="M6 1H10V2H12V3H13V4H14V6H15V10H14V12H13V13H12V14H10V15H6V14H4V13H3V12H2V10H1V6H2V4H3V3H4V2H6ZM5 4H6V7H7V4H8V7H9V4H10V8H9V9H8V12H7V9H6V8H5Z"/></svg>`;
const pngs = [];
for (const size of [16, 32, 48]) {
  const png = await sharp(Buffer.from(size === 16 ? micro : favicon)).resize(size, size).png().toBuffer();
  await writeFile(path.join(brand, `favicon-${size}.png`), png);
  pngs.push({ size, png });
}

// ICO directory entries wrap the same lossless PNGs used by modern browsers.
const header = Buffer.alloc(6 + pngs.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach(({ size, png }, index) => {
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(path.join(root, 'favicon.ico'), Buffer.concat([header, ...pngs.map(({ png }) => png)]));

await sharp(Buffer.from(mark)).resize(512, 512).png().toFile(path.join(brand, 'gastroglobe-mark.png'));
// Touch icons are opaque squares; the operating system supplies the corner mask.
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#efeae0"/><g transform="translate(8 8)">${markBody}</g></svg>`;
await sharp(Buffer.from(touch)).resize(180, 180).png().toFile(path.join(brand, 'apple-touch-icon.png'));
await sharp(Buffer.from(touch)).resize(512, 512).png().toFile(path.join(brand, 'app-icon-512.png'));

const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620">
  <rect width="1000" height="620" fill="#efeae0"/>
  <g transform="translate(354 54) scale(4.55)">${markBody}</g>
  <text x="500" y="404" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="56" font-weight="700" letter-spacing="-2.5" fill="#23201b">GastroGlobe</text>
  <text x="500" y="440" text-anchor="middle" font-family="Menlo,monospace" font-size="13" letter-spacing="2.3" fill="#5c5449">A WORLD OF FOOD.</text>
  <path d="M80 490H920" stroke="#d1c8b7"/>
  <g transform="translate(250 530) scale(.75)">${markBody}</g>
  <rect x="355" y="514" width="80" height="80" rx="16" fill="#23201b"/>
  <g transform="translate(371 530) scale(.75)">${markBody.replace('#23201b', '#efeae0')}</g>
  <g transform="translate(503 530) scale(.75)">${iconBody}</g>
  <g transform="translate(622 538) scale(.5)">${iconBody}</g>
  <image x="728" y="546" width="16" height="16" href="data:image/png;base64,${pngs[0].png.toString('base64')}"/>
</svg>`;
await sharp(Buffer.from(preview)).png().toFile(path.join(brand, 'logo-preview.png'));
console.log('Built SVG-derived logo, favicon sizes, multi-size ICO, touch icon, and preview.');
