// The feedback page and the theme on screen (PROJECT_PLAN §11.59): the first visit is dark, a saved light/dark/auto is kept, the input is checked
// (5..1000 characters), and the button opens the Google form in a new tab with the kind and the text filled in. NOTHING IS SUBMITTED to the form.
// Needs the app on APP_URL (default http://localhost:5173/). Usage: node feedbackcheck.mjs <toolsDir>
import { createRequire } from 'node:module';
import path from 'node:path';

const TOOLS = process.argv[2];
if (!TOOLS) throw new Error('usage: node feedbackcheck.mjs <toolsDir>');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
const URL = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const out = {};

// 1. theme: a fresh visit, then each saved choice (the OS is set to light so that "dark" can only come from the default)
for (const saved of [null, 'light', 'dark', 'auto']) {
  const ctx = await browser.newContext({ colorScheme: 'light', locale: 'ja-JP' });
  const page = await ctx.newPage();
  if (saved) await page.addInitScript((t) => localStorage.setItem('bl12.settings.v1', JSON.stringify({ pace: 'p15', prefecture: -1, theme: t, mode: 'normal', stars: 1 })), saved);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  out[`theme_${saved ?? 'fresh'}`] = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    saved: localStorage.getItem('bl12.settings.v1'),
  }));
  await ctx.close();
}

// 2. the toggle on a fresh visit: dark -> light, kept after a reload
{
  const ctx = await browser.newContext({ colorScheme: 'light', locale: 'ja-JP' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.click('button[aria-label="表示の明るさを切り替える"]');
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  out.toggle = { afterClick: a, afterReload: await page.evaluate(() => document.documentElement.getAttribute('data-theme')) };
  await ctx.close();
}

// 3. the feedback page: validation, then the opened Google form
const ctx = await browser.newContext({ locale: 'ja-JP' });
const page = await ctx.newPage();
await page.goto(URL + '#feedback', { waitUntil: 'load' });
await page.waitForSelector('#fb-text');
const btn = page.locator('form.feedback button[type=submit]');
const state = async () => ({ len: (await page.inputValue('#fb-text')).length, counter: (await page.locator('form.feedback p.small').innerText()).split('。')[0], enabled: await btn.isEnabled() });
out.notice = await page.locator('.notice').count();
out.options = await page.locator('#fb-cat option').allInnerTexts();
await page.fill('#fb-text', '');
out.v_empty = await state();
await page.fill('#fb-text', 'あいうえ');
out.v_4 = await state();
await page.fill('#fb-text', '     ');
out.v_spaces = await state();
await page.fill('#fb-text', 'あいうえお');
out.v_5 = await state();
await page.fill('#fb-text', 'あ'.repeat(1000));
out.v_1000 = await state();
await page.fill('#fb-text', 'あ'.repeat(1500));
out.v_1500 = await state();

await page.selectOption('#fb-cat', 'バグ / Bug');
const TEST = '【テスト】<b>太字</b> & "引用" 確認用の文字列 (送信しません)';
await page.fill('#fb-text', TEST);
out.v_normal = await state();
const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), btn.click()]);
await popup.waitForLoadState('domcontentloaded');
await popup.waitForTimeout(3000);
out.popupUrl = popup.url().replace(/entry\.1460004378=[^&]*/, 'entry.1460004378=…');
out.popupTitle = await popup.title();
out.checked = await popup.evaluate(() => [...document.querySelectorAll('[role=radio]')].map((r) => ({ label: r.getAttribute('aria-label') || r.getAttribute('data-value'), checked: r.getAttribute('aria-checked') })));
out.textarea = await popup.evaluate(() => (document.querySelector('textarea') || {}).value ?? null);
out.textMatches = out.textarea === TEST;
await popup.screenshot({ path: process.env.OUT_PNG || 'feedback-form.png' });
console.log(JSON.stringify(out, null, 1));
await browser.close();
