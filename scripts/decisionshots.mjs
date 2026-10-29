// A saved life that stands at a decision, opened from 続きから生きる at several widths: the dialog is shown and nothing sticks out.
// Usage: node decisionshots.mjs <outDir> <toolsDir> <savesDir> [widths]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const [OUT, TOOLS, SAVES] = process.argv.slice(2, 5);
if (!OUT || !TOOLS || !SAVES) throw new Error('usage: node decisionshots.mjs <outDir> <toolsDir> <savesDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const w of (process.argv[5] || '390,800,1280').split(',').map(Number)) {
  for (const f of fs.readdirSync(SAVES).filter((x) => x.endsWith('.json'))) {
    const name = f.replace('.json', '');
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 800, hasTouch: w < 800, locale: 'ja-JP' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const save = fs.readFileSync(path.join(SAVES, f), 'utf8');
    await page.addInitScript((s) => localStorage.setItem('bl12.save.v1', s), save);
    await page.goto(URL, { waitUntil: 'load' });
    await sleep(500);
    await page.click('button:has-text("続きから生きる")');
    const res = { w, name };
    try {
      await page.waitForSelector('.dialog .choices button', { timeout: 15000 });
      await sleep(500);
      // (other decisions queued before the one saved are answered with their first choice)
      for (let k = 0; k < 8 && !/志望校|来季の契約/.test((await page.textContent('.dialog h2')) || ''); k++) {
        await page.click('.dialog .choices button >> nth=0');
        await sleep(700);
        await page.waitForSelector('.dialog .choices button', { timeout: 8000 }).catch(() => {});
      }
      res.title = (await page.textContent('.dialog h2')) || '';
      res.choices = await page.locator('.dialog .choices button').count();
      res.hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      res.dialogFits = await page.evaluate(() => { const r = document.querySelector('.dialog').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
      await page.screenshot({ path: path.join(OUT, `${w}_${name}.png`) });
    } catch (e) { res.error = String(e).slice(0, 160); }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await ctx.close();
  }
}
await browser.close();