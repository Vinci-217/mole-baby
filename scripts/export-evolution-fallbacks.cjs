// Mechanical export of the original atlas's first frame using the same additive
// ColorTransform as Ram.tsx. No new poses, drawing, or generated character art.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
  try {
    const page = await browser.newPage();
    for (const form of ['super', 'water', 'wood', 'fire']) {
      const read = kind => `data:image/png;base64,${fs.readFileSync(path.join(root, `public/assets/classic/${form}-${kind}.png`)).toString('base64')}`;
      for (const [color, offsets] of Object.entries({ red: [255,-199,-250], yellow: [0,-21,-255], blue: [-215,-57,31], pink: [51,-148,0] })) {
        const result = await page.evaluate(async ({ neutral, mask, offsets }) => {
          const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
          const images = await Promise.all([load(neutral), load(mask)]);
          const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 208;
          const context = canvas.getContext('2d'); context.drawImage(images[0], 0, 0);
          const pixels = context.getImageData(0, 0, 192, 208);
          context.clearRect(0, 0, 192, 208); context.drawImage(images[1], 0, 0);
          const coverage = context.getImageData(0, 0, 192, 208).data;
          const clamp = value => Math.max(0, Math.min(255, value));
          const deltas = [255,204,153].map(base => offsets.map(offset => clamp(base + offset) - base));
          for (let i = 0; i < pixels.data.length; i += 4) for (let c = 0; c < 3; c++) pixels.data[i+c] = clamp(pixels.data[i+c] + deltas[0][c]*coverage[i]/255 + deltas[1][c]*coverage[i+1]/255 + deltas[2][c]*coverage[i+2]/255);
          context.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png').split(',')[1];
        }, { neutral: read('neutral'), mask: read('mask'), offsets });
        fs.writeFileSync(path.join(root, `public/assets/original/pets/${form}-${color}-idle.png`), Buffer.from(result, 'base64'));
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
