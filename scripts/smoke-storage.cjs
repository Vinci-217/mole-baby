const assert = require('node:assert/strict');

const pendingKey = 'mole-smoke-next-storage-v1';
const initialized = new WeakSet();

/** Apply a test save before the new renderer starts, never against a live autosave. */
async function reloadWithStorage(page, snapshot) {
  assert.ok(snapshot && Object.values(snapshot).every(value => typeof value === 'string'));
  if (!initialized.has(page)) {
    await page.addInitScript(({ pendingKey }) => {
      const raw = sessionStorage.getItem(pendingKey);
      if (raw === null) return;
      sessionStorage.removeItem(pendingKey);
      const entries = JSON.parse(raw);
      localStorage.clear();
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, { pendingKey });
    initialized.add(page);
  }
  await page.evaluate(({ pendingKey, snapshot }) => {
    sessionStorage.setItem(pendingKey, JSON.stringify(snapshot));
  }, { pendingKey, snapshot });
  await page.reload();
}

module.exports = { reloadWithStorage };
