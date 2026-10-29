// The result screen at two widths on lives that reach it quickly (PROJECT_PLAN §11.50): a pro life and a potential-mode life (shared-link
// seeds, the pace 「結果だけ」), the folded panels (click, click again, keyboard), their order, what sticks out sideways, and whether the
// fixed bar covers the end of the page. Needs the app on APP_URL (default http://localhost:4173/).
// Usage: node resultcheck.mjs <outDir> <toolsDir> [widths]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const TOOLS = process.argv[3];
if (!OUT || !TOOLS) throw new Error('usage: node resultcheck.mjs <outDir> <toolsDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CASES = [
  { name: 'pro', qs: '?s=2463075677' },
  { name: 'pot', qs: '?s=765622937&m=p&k=8' },
];

const sideways = () => {
  const w = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= w + 1) continue;
    let p = el.parentElement;
    let boxed = false;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') boxed = true;
      p = p.parentElement;
    }
    if (!boxed && getComputedStyle(el).position !== 'fixed') out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(r.right)}`);
  }
  return out.slice(0, 6);
};

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const w of (process.argv[4] || '390,1280').split(',').map(Number)) {
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 844 : 900 }, isMobile: w < 800, hasTouch: w < 800, locale: 'ja-JP' });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('bl12.settings.v1', JSON.stringify({ pace: 'instant', prefecture: -1, theme: 'light', mode: 'normal', stars: 1 })));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const res = { w, case: c.name };
    try {
      await page.goto(URL + c.qs, { waitUntil: 'load' });
      await sleep(500);
      await page.click('.sharedbirth .btn.primary');
      await page.waitForSelector('button:text-is("人生を始める")', { timeout: 20000 });
      await page.click('button:text-is("人生を始める")');
      await page.waitForSelector('.ending', { timeout: 120000 });
      await sleep(800);
      await page.click('.ending .skip').catch(() => {});
      await sleep(800);
      await page.click('.ending button:has-text("記録を見る")', { timeout: 20000 });
      for (let i = 0; i < 240 && (await page.$('text=同じ条件の試行を計算しています')); i++) await sleep(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${w}_${c.name}_1_top.png`) });
      res.sideways = await page.evaluate(sideways);
      res.panels = await page.evaluate(() => [...document.querySelectorAll('.result > *, .result > .two > *')].map((e) => `${(String(e.className).match(/ro-\w+/) || [e.tagName.toLowerCase()])[0]}@${Math.round(e.getBoundingClientRect().top + scrollY)}`));
      res.folds = await page.evaluate(() => [...document.querySelectorAll('details.fold')].map((d) => d.querySelector('summary').innerText.replace(/\s+/g, ' ').trim()));
      // every fold: shut at first; a click opens it with content; a click shuts it; Enter opens it; Space shuts it
      const n = await page.locator('details.fold').count();
      res.fold = [];
      for (let i = 0; i < n; i++) {
        const d = page.locator('details.fold').nth(i);
        const sum = d.locator('summary');
        const st = { title: (await sum.innerText()).replace(/\s+/g, ' ').slice(0, 24), shut: !(await d.evaluate((e) => e.open)) };
        await sum.scrollIntoViewIfNeeded();
        await sum.click();
        st.opened = await d.evaluate((e) => e.open);
        st.bodyLen = await d.locator('.foldbody').innerText().then((t) => t.trim().length);
        st.bodyVisible = await d.locator('.foldbody').isVisible();
        if (i === 0 || st.title.startsWith('プロの') || st.title.startsWith('素質')) await page.screenshot({ path: path.join(OUT, `${w}_${c.name}_2_open${i}.png`) });
        st.sideOpen = (await page.evaluate(sideways)).length;
        await sum.click();
        st.closed = !(await d.evaluate((e) => e.open));
        await sum.focus();
        await page.keyboard.press('Enter');
        st.enter = await d.evaluate((e) => e.open);
        await page.keyboard.press('Space');
        st.space = !(await d.evaluate((e) => e.open));
        res.fold.push(st);
      }
      // all open, the page as a whole
      await page.evaluate(() => document.querySelectorAll('details.fold').forEach((d) => (d.open = true)));
      await sleep(300);
      res.sidewaysAllOpen = await page.evaluate(sideways);
      await page.screenshot({ path: path.join(OUT, `${w}_${c.name}_3_allopen_full.png`), fullPage: true });
      // the end of the page: does the fixed bar cover the last content?
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(300);
      res.end = await page.evaluate(() => {
        const bar = document.querySelector('.footer-bar')?.getBoundingClientRect();
        const last = [...document.querySelectorAll('.result > *')].filter((e) => !e.classList.contains('footer-bar')).pop()?.getBoundingClientRect();
        return { barTop: bar && Math.round(bar.top), lastBottom: last && Math.round(last.bottom), vh: innerHeight };
      });
      await page.screenshot({ path: path.join(OUT, `${w}_${c.name}_4_end.png`) });
    } catch (e) {
      errors.push(String(e).slice(0, 240));
    }
    res.errors = errors;
    console.log(JSON.stringify(res));
    await ctx.close();
  }
}
await browser.close();
