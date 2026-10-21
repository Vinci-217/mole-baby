/** macOS templates use the image alpha as a glyph; AppKit supplies the tint
 * for the current menu bar appearance and highlighted menu state. */
function createTrayIcon(nativeImage, platform, iconPath) {
  const mac = platform === 'darwin';
  const image = nativeImage.createFromPath(iconPath(mac ? 'tray-mac.png' : 'tray.png'));
  if (mac) image.setTemplateImage(true);
  return image;
}
module.exports = { createTrayIcon };
