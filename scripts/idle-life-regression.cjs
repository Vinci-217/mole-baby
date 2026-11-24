/** Replay native walk cadences against the real React hook with a virtual clock.
 * Point MOLE_IDLE_REVIEW_URL at an existing Vite development preview. */
const {chromium, expect} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.MOLE_IDLE_REVIEW_URL || 'http://127.0.0.1:5190';
const out = path.resolve(__dirname, '../artifacts/idle-life-regression');
const report = {checks: [], errors: []};

async function probe(browser, idleMs = 0, enabled = true, intervalSeconds) {
  const page = await browser.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/idle-life-qa', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><div id="root"></div></body></html>',
  }));
  await page.clock.install({time: new Date('2026-11-18T12:00:00Z')});
  await page.clock.pauseAt(new Date('2026-11-18T12:00:01Z'));
  await page.goto(origin + '/idle-life-qa');
  await page.evaluate(async ({idleMs, enabled, intervalSeconds}) => {
    const R = await import('/node_modules/.vite/deps/react.js');
    const D = await import('/node_modules/.vite/deps/react-dom_client.js');
    const DOM = await import('/node_modules/.vite/deps/react-dom.js');
    const React = R.default ?? R, {createRoot} = D.default ?? D;
    const {flushSync} = DOM.default ?? DOM;
    const {useIdleLife} = await import('/src/use-idle-life.ts');
    const {createPet} = await import('/src/game.ts');
    const pet = createPet('随机动作核对', 'blue', Date.now() - 86400000);
    pet.growth = 180;
    pet.stats = {hunger: 95, thirst: 95, health: 100, happiness: 95, cleanliness: 95, energy: 95};
    const control = {pet, enabled, intervalSeconds, blocked: false, hidden: false};
    const actions = [];
    let moving = false, performing = false;
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => control.hidden});
    window.__idleQA = {actions, startedAt: Date.now(), pet};

    function Probe() {
      const [, render] = React.useReducer(value => value + 1, 0);
      // React's MessageChannel scheduler is outside the virtual clock. Commit
      // each native state change before advancing to the next timer callback.
      const refresh = () => flushSync(render);
      window.__idleQA.configure = patch => {
        const visibilityChanged = 'hidden' in patch && patch.hidden !== control.hidden;
        Object.assign(control, patch);
        refresh();
        if (visibilityChanged) document.dispatchEvent(new Event('visibilitychange'));
      };
      React.useEffect(() => {
        let timer;
        if (idleMs) {
          const walk = () => {
            moving = true; refresh();
            timer = setTimeout(() => {
              moving = false; refresh();
              timer = setTimeout(walk, idleMs);
            }, 2500);
          };
          timer = setTimeout(walk, idleMs);
        }
        window.__idleQA.ready = true;
        return () => clearTimeout(timer);
      }, []);
      useIdleLife({
        pet: control.pet, enabled: control.enabled,
        intervalSeconds: control.intervalSeconds,
        blocked: control.blocked || moving || performing,
        onAction(action, sequence) {
          actions.push({action, sequence, at: Date.now(), moving,
            suppressed: !control.enabled || control.blocked || control.hidden});
          performing = true; refresh();
          setTimeout(() => {performing = false; refresh();}, 4500);
        },
      });
      return null;
    }
    createRoot(document.getElementById('root')).render(React.createElement(Probe));
  }, {idleMs, enabled, intervalSeconds});
  await expect.poll(() => page.evaluate(() => window.__idleQA.ready)).toBe(true);
  return page;
}

const actions = page => page.evaluate(() => window.__idleQA.actions);
async function configure(page, patch) {
  await page.evaluate(patch => window.__idleQA.configure(patch), patch);
  await page.clock.runFor(1);
}

async function main() {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium', headless: true,
    args: ['--disable-gpu'],
  });
  try {
    for (const [label, idleMs] of [
      ['stationary', 0], ['desktop-12s', 12000], ['desktop-15s', 15000],
      ['desktop-18s', 18000], ['mobile-30s', 30000], ['mobile-60s', 60000],
    ]) {
      const page = await probe(browser, idleMs);
      await page.clock.runFor(119000);
      assert.equal((await actions(page)).length, 0, 'No action before the default 120 seconds');
      await page.clock.runFor(10 * 60000 - 119000);
      const seen = await actions(page);
      assert.ok(seen.length >= 3 && seen.length <= 5, label + ': ' + JSON.stringify(seen));
      assert.ok(seen.every(action => !action.moving && !action.suppressed));
      for (let index = 1; index < seen.length; index++) {
        assert.ok(seen[index].at - seen[index - 1].at >= 120000, 'No catch-up bursts');
        assert.notEqual(seen[index].action, seen[index - 1].action);
      }
      const firstActionMs = seen[0].at - await page.evaluate(() => window.__idleQA.startedAt);
      if (!idleMs) assert.equal(firstActionMs, 120000, 'Default interval has no random timing jitter');
      const result = {label, virtualMinutes: 10, actions: seen.length, firstActionMs, noActionsDuringWalk: true, noBursts: true};
      report.checks.push(result); console.log(JSON.stringify(result));
      await page.close();
    }

    const custom = await probe(browser, 0, true, 30);
    await custom.clock.runFor(29999);
    assert.equal((await actions(custom)).length, 0);
    await custom.clock.runFor(1);
    assert.equal((await actions(custom)).length, 1, 'Custom 30-second interval is used');
    await custom.clock.runFor(5000);
    await configure(custom, {intervalSeconds: 120});
    await custom.clock.runFor(119000);
    assert.equal((await actions(custom)).length, 1, 'Lengthening the interval replaces the old deadline');
    await custom.clock.runFor(1100);
    assert.equal((await actions(custom)).length, 2);
    await custom.clock.runFor(5000);
    await configure(custom, {blocked: true, intervalSeconds: 10});
    await custom.clock.runFor(60000);
    assert.equal((await actions(custom)).length, 2, 'Changing settings while busy does not start an action');
    await configure(custom, {blocked: false});
    assert.equal((await actions(custom)).length, 3, 'The new interval keeps counting while busy');
    await custom.clock.runFor(9998);
    assert.equal((await actions(custom)).length, 3, 'Returning to idle produces exactly one action');
    report.checks.push({label: 'custom-interval-and-live-changes', seconds: [30, 120, 10], passed: true});
    await custom.close();

    const page = await probe(browser, 0, false);
    await page.clock.runFor(6 * 60000);
    assert.equal((await actions(page)).length, 0, 'Disabled preference remains authoritative');
    await configure(page, {enabled: true});
    await page.clock.runFor(6000);
    assert.equal((await actions(page)).length, 0, 'Enabling starts the normal initial wait');
    await configure(page, {blocked: true});
    await page.clock.runFor(6 * 60000);
    assert.equal((await actions(page)).length, 0, 'Busy and quiet states suppress actions');
    await configure(page, {blocked: false});
    await page.clock.runFor(5100);
    assert.equal((await actions(page)).length, 1, 'A due action resumes after a pause');
    await page.clock.runFor(5000);
    await configure(page, {hidden: true});
    await page.clock.runFor(6 * 60000);
    assert.equal((await actions(page)).length, 1, 'Hidden windows do not start actions');
    await configure(page, {hidden: false});
    await page.clock.runFor(5100);
    assert.equal((await actions(page)).length, 2, 'Visibility resumes one due action');
    await page.clock.runFor(5000);
    assert.equal((await actions(page)).length, 2, 'Returning from the background does not burst');
    report.checks.push({label: 'preference-busy-and-visibility', passed: true});
    await page.close();

    const recovery = await probe(browser);
    await recovery.clock.runFor(110000);
    const pet = await recovery.evaluate(() => window.__idleQA.pet);
    await configure(recovery, {pet: {...pet, sleeping:true, stats: {...pet.stats, energy:24}}});
    await recovery.clock.runFor(120000);
    assert.equal((await actions(recovery)).length, 0, 'Sleep suppresses playback');
    await configure(recovery, {pet: {...pet, stats: {...pet.stats, energy:28, hunger:22}}});
    assert.equal((await actions(recovery))[0]?.action, 'ambient-hungry');
    await recovery.clock.runFor(14500);
    await configure(recovery, {enabled:false});
    await recovery.clock.runFor(240000);
    assert.equal((await actions(recovery)).length, 1);
    await configure(recovery, {enabled:true});
    await recovery.clock.runFor(119998);
    assert.equal((await actions(recovery)).length, 1, 'An explicitly re-enabled switch starts a new interval');
    await recovery.clock.runFor(10);
    assert.equal((await actions(recovery)).length, 2);
    report.checks.push({label: 'care-recovery-and-reenable', passed:true});
    await recovery.close();
    assert.deepEqual(report.errors, []);
    report.passed = true;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
