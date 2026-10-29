// Open the money screen (お金を使う · 投資) on saved lives in the built app at two widths: screenshots, the clock held while it is open,
// a purchase going through to the savings and the log, the settings. Needs `dev.sh preview` running.
// Usage: node shopcheck.mjs <outDir> <toolsDir> <savesDir> [widths]   (savesDir: *.json LifeState saves, e.g. from a script)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const TOOLS = process.argv[3];
const SAVES = process.argv[4];
if (!OUT || !TOOLS || !SAVES) throw new Error('usage: node shopcheck.mjs <outDir> <toolsDir> <savesDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ageOf = async (page) => Number((await page.locator('.agebox .age').first().innerText()).replace(/\D/g, ''));

for (const w of (process.argv[5] || '1280,390').split(',').map(Number)) {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const file of fs.readdirSync(SAVES).filter((f) => f.endsWith('.json'))) {
    const name = file.replace('.json', '');
    const save = fs.readFileSync(path.join(SAVES, file), 'utf8');
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390, locale: 'ja-JP' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    const res = { name, w };
    try {
      await page.goto(URL, { waitUntil: 'load' });
      await page.evaluate((s) => localStorage.setItem('bl12.save.v1', s), save);
      await page.reload({ waitUntil: 'load' });
      await sleep(500);
      await page.click('button:has-text("続きから生きる")');
      await page.waitForSelector('.life', { timeout: 10000 });
      await sleep(600);
      const btn = page.locator('.moneybar .shopbtn:visible').first();
      res.buttonVisible = await btn.isVisible().catch(() => false);
      await page.screenshot({ path: path.join(OUT, `${w}_${name}_0_life.png`) });
      const age0 = await ageOf(page);
      await btn.click({ timeout: 5000 });
      await page.waitForSelector('.dialog.shop', { timeout: 5000 });
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${w}_${name}_1_open.png`) });
      res.hscroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      res.title = await page.locator('.dialog.shop h2').innerText();
      res.cards = await page.locator('.shopcard').count();
      res.enabledPills = await page.locator('.shopcard .pill:not(:disabled)').count();
      res.disabledPills = await page.locator('.shopcard .pill:disabled').count();
      res.offCards = await page.locator('.shopcard.off').count();
      // the clock stands still while it is open
      await sleep(2500);
      res.clockHeld = (await ageOf(page)) === age0;
      // a purchase
      if (res.enabledPills > 0) {
        const pill = page.locator('.shopcard .pill:not(:disabled)').first();
        res.pill = (await pill.innerText()).replace(/\n/g, ' / ');
        await pill.click();
        await sleep(500);
        res.afterTitle = await page.locator('.dialog.shop h2').innerText();
        res.done = await page.locator('.shopdone').first().innerText().catch(() => '');
        await page.screenshot({ path: path.join(OUT, `${w}_${name}_2_bought.png`) });
      }
      // the settings
      await page.locator('.dialog.shop summary:has-text("暮らし方")').click();
      await page.locator('.dialog.shop .vehicles .pill >> nth=3').click();
      await sleep(300);
      res.vehicle = await page.locator('.dialog.shop summary:has-text("暮らし方") .cur').innerText();
      await page.locator('.dialog.shop summary:has-text("保険・食生活")').click();
      await page.locator('.dialog.shop .insurances .pill >> nth=1').click();
      await page.locator('.dialog.shop .diets .pill >> nth=1').click();
      await sleep(200);
      res.care = await page.locator('.dialog.shop summary:has-text("保険・食生活") .cur').innerText();
      res.trend = await page.locator('.dialog.shop .shoptrend').count();
      const autos =page.locator('.dialog.shop summary:has-text("自動で続ける")');
      if (await autos.count()) {
        await autos.click();
        await page.locator('.dialog.shop .autos .pill >> nth=0').click();
        res.auto = await autos.locator('.cur').innerText();
      }
      await page.locator('.dialog.shop').evaluate((el) => (el.scrollTop = el.scrollHeight));
      await sleep(300);
      await page.screenshot({ path: path.join(OUT, `${w}_${name}_3_settings.png`) });
      await page.click('.dialog.shop .hd .btn');
      await sleep(300);
      res.closed = (await page.locator('.dialog.shop').count()) === 0;
      // the clock runs again
      for (let i = 0; i < 30 && !res.clockRuns; i++) {
        await sleep(1000);
        res.clockRuns = (await ageOf(page)) > age0 || (await page.locator('.dialog:not(.shop)').count()) > 0;
      }
    } catch (e) {
      res.error = String(e.message).slice(0, 300);
    }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await ctx.close();
  }
  await browser.close();
}
