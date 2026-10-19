const { expect } = require('@playwright/test');

async function adopt(page, color = '蓝色', name = '小蓝') {
  const colors = page.getByRole('button', { name: /^选择.+色拉姆$/ });
  await expect(colors).toHaveCount(4);
  await page.getByRole('button', { name: `选择${color}拉姆`, exact: true }).click();
  await page.getByRole('button', { name: '给它起名', exact: true }).click();
  await page.locator('#pet-name').fill(name);
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  await page.getByTestId('desktop-character').waitFor();
}
async function openActions(page) {
  const actions = page.getByTestId('pet-actions');
  if (!(await actions.isVisible())) await page.getByTestId('desktop-character').click();
  await expect(actions).toBeVisible();
  return actions;
}
async function enterHome(page) {
  if (await page.locator('.cottage-scene').isVisible()) return;
  const actions = await openActions(page);
  await actions.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
}
async function roomTab(page, label) {
  const paperButton = page.locator('.paper-tabs').getByRole('button', { name: label, exact: true });
  if (await paperButton.isVisible()) { await paperButton.click(); return; }
  // Every room function is also reachable without an open paper dialog.
  const dock = page.locator('.classic-dock');
  const aliases = { 状态: ['状态', '我的拉姆'], 背包: ['背包', '打开背包', '食物口袋'], 商店: ['商店', '进入商店', '拉姆商店'], 游戏: ['游戏', '游乐时光'], 成长: ['成长', '成长手册'], 对话: ['对话', '和拉姆说话'], 设置: ['设置', '陪伴设置'] };
  for (const name of aliases[label] || [label]) {
    const button = dock.getByRole('button', { name, exact: true });
    if (await button.isVisible()) { await button.click(); return; }
  }
  throw new Error(`No visible room navigation for ${label}`);
}
async function toDesktop(page) {
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  while (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: '回到桌面', exact: true }).click();
  await page.getByTestId('desktop-character').waitFor();
}
async function selectPocket(page, id, label) {
  const pocket = page.locator('.care-pocket');
  const item = pocket.locator(`.pocket-slot[data-item-id="${id}"]`);
  if (!(await item.count())) {
    const next = pocket.getByRole('button', { name: '背包下一页', exact: true });
    while (!(await item.count()) && await next.isEnabled()) await next.click();
  }
  await item.click();
  const use = pocket.getByRole('button', { name: `使用${label}`, exact: true });
  await expect(use).toBeVisible();
  return use;
}
async function buy(page, id, label, category = '食物') {
  await roomTab(page, '商店');
  const shop = page.locator('.shop-book');
  await shop.getByRole('button', { name: `翻开${category}商品书`, exact: true }).click();
  const item = shop.locator(`.book-product[data-item-id="${id}"]`);
  if (!(await item.count())) {
    const next = shop.getByRole('button', { name: '商店下一页', exact: true });
    while (!(await item.count()) && await next.isEnabled()) await next.click();
  }
  await item.click();
  const button = shop.getByRole('button', { name: `购买${label}`, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}
module.exports = { adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy };
