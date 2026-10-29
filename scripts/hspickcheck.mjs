// The high-school choice (「志望校を選ぶ」) on screen, played from a shared-link birth (PROJECT_PLAN §11.52): the dialog with the recommended
// schools is reached by normal play, shown, put away (「あとで決める」) and brought back, a school other than the first is chosen, and nothing sticks
// out or needs sideways scrolling. Needs the app on APP_URL (default http://localhost:4173/).
// Usage: node hspickcheck.mjs <outDir> <toolsDir> [widths] ; SEED_QS defaults to a potential-mode birth whose list is recommendations.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const [OUT, TOOLS] = process.argv.slice(2, 4);
if (!OUT || !TOOLS) throw new Error('usage: node hspickcheck.mjs <outDir> <toolsDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const QS = process.env.SEED_QS || '?s=2742301400&m=p&k=9';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const w of (process.argv[4] || '390,800,1280').split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 800, hasTouch: w < 800, locale: 'ja-JP' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const res = { w };
  try {
    await page.goto(URL + QS, { waitUntil: 'load' });
    await sleep(500);
    await page.click('.sharedbirth .btn.primary');
    await page.waitForSelector('button:text-is("人生を始める")', { timeout: 20000 });
    await page.click('button:text-is("人生を始める")');
    await sleep(1500);
    await page.click('button:text-is("16×")').catch(() => {});
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const dlg = await page.$('.dialog .choices button');
      if (dlg) {
        const title = ((await page.textContent('.dialog h2')) || '').trim();
        if (/志望校/.test(title)) break;
        await page.click('.dialog .choices button >> nth=0', { timeout: 3000 }).catch(() => {});
      } else {
        const ff = await page.$(w < 800 ? '.controls button.jp[aria-pressed="false"]' : 'button[aria-pressed="false"]:has-text("次の決断まで")');
        if (ff) await ff.click({ timeout: 3000 }).catch(() => {});
      }
      await sleep(400);
    }
    res.title = ((await page.textContent('.dialog h2').catch(() => '')) || '').trim();
    if (!/志望校/.test(res.title)) throw new Error('the choice of the school did not come: ' + res.title);
    await sleep(400);
    res.options = await page.locator('.dialog .choices button').allInnerTexts();
    res.hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    res.fits = await page.evaluate(() => { const r = document.querySelector('.dialog').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; });
    res.scrollable = await page.evaluate(() => { const d = document.querySelector('.dialog'); return d.scrollHeight > d.clientHeight; });
    await page.screenshot({ path: path.join(OUT, `${w}_1_dialog.png`) });
    // put it away and bring it back (the way back: the choice is not lost)
    await page.click('.dialog button:has-text("あとで決める")');
    await sleep(500);
    res.peek = !!(await page.$('.peek button'));
    await page.screenshot({ path: path.join(OUT, `${w}_2_peek.png`) });
    await page.click('.peek button');
    await sleep(500);
    res.backAgain = (await page.locator('.dialog .choices button').count()) === res.options.length;
    // the lower part of the dialog, then a school other than the first
    await page.evaluate(() => { const d = document.querySelector('.dialog'); d.scrollTop = d.scrollHeight; });
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, `${w}_3_scrolled.png`) });
    const pick = Math.min(1, res.options.length - 1);
    await page.click(`.dialog .choices button >> nth=${pick}`);
    await sleep(1500);
    res.picked = res.options[pick].replace(/\s+/g, ' ').slice(0, 40);
    res.logLine = (await page.locator('.feed li, .log li').allInnerTexts().catch(() => [])).filter((x) => /合格|進学|受験|入学/.test(x)).slice(0, 2);
    await page.screenshot({ path: path.join(OUT, `${w}_4_after.png`) });
  } catch (e) {
    res.error = String(e).slice(0, 200);
  }
  res.errors = errors;
  console.log(JSON.stringify(res));
  await ctx.close();
}
await browser.close();
