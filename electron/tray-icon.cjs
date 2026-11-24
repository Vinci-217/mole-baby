/** macOS templates use the image alpha as a glyph; AppKit supplies the tint
 * for the current menu bar appearance and highlighted menu state. */
function createTrayIcon(nativeImage, platform, iconPath) {
  if (platform !== 'darwin') return nativeImage.createFromPath(iconPath('tray.png'));
  const template = nativeImage.createFromPath(iconPath('tray-mac.png'));
  const size = 20;
  const image = template.resize({ width: size, height: size, quality: 'best' });
  // resize creates a single representation. Resize the Retina source at its
  // own resolution so macOS can still pick the sharper glyph.
  for (const scaleFactor of template.getScaleFactors()) {
    if (scaleFactor === 1) continue;
    const pixels = Math.round(size * scaleFactor);
    const representation = nativeImage.createFromBuffer(template.toPNG({ scaleFactor }));
    const resized = representation.resize({ width: pixels, height: pixels, quality: 'best' });
    image.addRepresentation({ scaleFactor, buffer: resized.toPNG() });
  }
  image.setTemplateImage(true);
  return image;
}
module.exports = { createTrayIcon };
