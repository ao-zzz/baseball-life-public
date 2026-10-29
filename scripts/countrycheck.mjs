// The choice of the country at both widths (PROJECT_PLAN §11.46): Korea and Cuba chosen, their beta marks and places, the start of a life
// up to the birth certificate; no horizontal scroll, no errors. Needs `dev.sh preview` running.
// Usage: node countrycheck.mjs <outDir> <toolsDir> [widths]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const TOOLS = process.argv[3];
if (!OUT || !TOOLS) throw new Error('usage: node countrycheck.mjs <outDir> <toolsDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const w of (process.argv[4] || '1280,390').split(',').map(Number)) {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  for (const cc of ['KR', 'CU', 'US']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390, locale: 'ja-JP' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
    const res = { cc, w };
    try {
      await page.goto(URL, { waitUntil: 'load' });
      await sleep(400);
      res.options = await page.locator('#country option').allInnerTexts();
      await page.selectOption('#country', cc);
      await sleep(300);
      res.funnel = (await page.locator('.funnel h2').innerText()).trim();
      res.regionLabel = (await page.locator('label[for=pref]').innerText()).trim();
      res.firstRegion = await page.locator('#pref option >> nth=1').innerText();
      await page.screenshot({ path: path.join(OUT, `${w}_${cc}_1_intro.png`), fullPage: true });
      res.hscroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      await page.locator(w === 390 ? '.sticky-cta button' : '.cta').first().click();
      await page.waitForSelector('.cert-wrap, .roll', { timeout: 10000 });
      for (let i = 0; i < 40 && !(await page.locator('.cert-wrap').count()); i++) await sleep(500);
      await sleep(300);
      res.cert = (await page.locator('.cert-wrap .story').innerText()).trim();
      res.name = (await page.locator('.cert-wrap .name').innerText()).trim();
      await page.screenshot({ path: path.join(OUT, `${w}_${cc}_2_cert.png`), fullPage: true });
      res.hscrollCert = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    } catch (e) {
      res.error = String(e.message).slice(0, 300);
    }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await ctx.close();
  }
  await browser.close();
}