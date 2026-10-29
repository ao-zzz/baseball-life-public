// The counter of lives begun against the LOCAL stand-in server (counter/dev-server.ts; PROJECT_PLAN §11.51): the title page shows the number,
// a new life adds one, a reload and a cancelled birth certificate add nothing, a resumed life adds nothing, and a server that is down
// changes nothing in the game (the line says it cannot be read, the life starts, the id is kept and sent when the server is back).
// Needs: the game built with VITE_COUNTER_URL=http://localhost:8787 served on APP_URL, the stand-in on 8787 (phase 1), and later
// stopped and started again by the caller between phases: node countercheck.mjs <outDir> <toolsDir> <phase: up|down|back> [width]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const [OUT, TOOLS, PHASE, W] = [process.argv[2], process.argv[3], process.argv[4], Number(process.argv[5] || 1280)];
if (!OUT || !TOOLS || !PHASE) throw new Error('usage: node countercheck.mjs <outDir> <toolsDir> <up|down|back> [width]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const API = process.env.COUNTER_API || 'http://localhost:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const total = async () => (await (await fetch(`${API}/api/count`)).json()).total;

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
// one browser profile for the three phases (the pending ids are in its localStorage): a persistent context
const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, isMobile: W < 800, hasTouch: W < 800, locale: 'ja-JP', storageState: fs.existsSync(path.join(OUT, 'state.json')) ? path.join(OUT, 'state.json') : undefined });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const res = { phase: PHASE };
const line = async () => ((await page.locator('.lifecount').count()) ? (await page.locator('.lifecount').innerText()).replace(/\s+/g, ' ') : null);
const begin = async () => {
  await page.click(W < 800 ? '.sticky-cta button' : '.cta-row .btn.cta');
  await page.waitForSelector('button:text-is("人生を始める"), .roll', { timeout: 20000 });
  for (let i = 0; i < 20 && !(await page.$('button:text-is("人生を始める")')); i++) await sleep(300);
};
await page.goto(URL, { waitUntil: 'load' });
await sleep(800);
res.homeLine = await line();
await page.screenshot({ path: path.join(OUT, `${PHASE}_${W}_home.png`) });
res.hscroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (PHASE === 'up') {
  res.before = await total();
  // the birth certificate is opened and cancelled: nothing is counted
  await begin();
  await page.click('button:has-text("やめる"), button:has-text("戻る"), button:has-text("キャンセル")').catch(() => {});
  await sleep(500);
  res.afterCancel = await total();
  await page.goto(URL, { waitUntil: 'load' });
  await begin();
  await page.click('button:text-is("人生を始める")');
  await sleep(1500);
  res.afterBegin = await total();
  // a reload during the life, then the title page, then resume: no new count
  await page.reload({ waitUntil: 'load' });
  await sleep(1000);
  res.afterReload = await total();
  const resume = page.locator('button:has-text("続きから")');
  res.resumeButton = await resume.count();
  if (res.resumeButton) {
    await resume.first().click();
    await sleep(1500);
  }
  res.afterResume = await total();
  res.homeLineAfter = (await page.goto(URL, { waitUntil: 'load' }), await sleep(800), await line());
} else if (PHASE === 'down') {
  // the server is stopped by the caller: the line says it cannot be read, and a life still starts
  await begin();
  await page.click('button:text-is("人生を始める")');
  await sleep(2500);
  res.lifeStarted = !!(await page.$('.agebox .age, .controls'));
  res.pending = await page.evaluate(() => localStorage.getItem('bl12.counter.pending.v1'));
} else if (PHASE === 'back') {
  res.pendingBefore = await page.evaluate(() => localStorage.getItem('bl12.counter.pending.v1'));
  res.totalBefore = await total();
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  res.pendingAfter = await page.evaluate(() => localStorage.getItem('bl12.counter.pending.v1'));
  res.totalAfter = await total();
  res.homeLineAfter = await line();
}
await ctx.storageState({ path: path.join(OUT, 'state.json') });
res.errors = errors;
console.log(JSON.stringify(res));
await browser.close();
