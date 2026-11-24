/** Crop exported book frames to nonzero alpha; preserve all visible pixels. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
(async () => {
  const request = JSON.parse(fs.readFileSync(0, 'utf8'));
  for (const { source, destination } of request.files) {
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3]) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (right < 0) throw Error('Empty book frame: ' + source);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await sharp(source).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toFile(destination);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
