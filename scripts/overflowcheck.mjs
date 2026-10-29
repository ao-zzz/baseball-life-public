// Elements that stick out of the right edge of the screen (PROJECT_PLAN §11.48), on the intro and on the start of a life, at narrow
// widths. body has overflow-x: hidden, so scrollWidth cannot show it: every element's own box is measured. Needs the app on APP_URL
// (default http://localhost:4173/, `npm run preview`).
// Usage: node overflowcheck.mjs <outDir> <toolsDir> [widths]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const TOOLS = process.argv[3];
if (!OUT || !TOOLS) throw new Error('usage: node overflowcheck.mjs <outDir> <toolsDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** boxes that end beyond the viewport (inside a scroll box of its own they do not count) */
const measure = () => {
  const w = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    // (a box whose own text runs past its edge counts too: the box itself fits, its text is cut)
    const spill = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && !['TABLE', 'TR'].includes(el.tagName)
    if (!r.width || (r.right <= w + 1 && !spill)) continue;
    let p = el.parentElement;
    let boxed = false;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') boxed = true
      p = p.parentElement;
    }
    if (boxed || getComputedStyle(el).position === 'fixed') continue;
    out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(r.right)} text=${(el.textContent || '').trim().slice(0, 14)}`);
  }
  return { w, count: out.length, first: out.slice(0, 8) };
};

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const w of (process.argv[4] || '393,390,375,320,1280').split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, isMobile: w < 800, hasTouch: w < 800, locale: 'ja-JP' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const res = { w };
  try {
    await page.goto(URL, { waitUntil: 'load' });
    await sleep(400);
    res.intro = await page.evaluate(measure);
    await page.screenshot({ path: path.join(OUT, `${w}_intro.png`), fullPage: true });
    await page.locator(w < 800 ? '.sticky-cta button' : '.cta').first().click();
    for (let i = 0; i < 40 && !(await page.locator('.cert-wrap').count()); i++) await sleep(500);
    await sleep(300);
    res.cert = await page.evaluate(measure);
    await page.screenshot({ path: path.join(OUT, `${w}_cert.png`), fullPage: true });
  } catch (e) {
    errors.push(String(e).slice(0, 200));
  }
  res.errors = errors;
  console.log(JSON.stringify(res));
  await ctx.close();
}
await browser.close();
