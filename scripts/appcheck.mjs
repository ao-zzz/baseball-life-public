// Drive the local build through a full life at two widths, saving screenshots and checks.
// Usage (via scripts/uicheck.ps1): node appcheck.mjs <outDir> <toolsDir> <widths>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const TOOLS = process.argv[3];
if (!OUT || !TOOLS) throw new Error('usage: node appcheck.mjs <outDir> <toolsDir> [widths]');
const require = createRequire(path.join(TOOLS, 'pw', 'package.json'));
const { chromium } = require('playwright-core');
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(w) {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390, locale: 'ja-JP' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  const checks = {};
  const hscroll = async (name) => {
    checks[name] = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  };
  const shot = async (name, full = false) => {
    await page.screenshot({ path: path.join(OUT, `${w}_${name}.png`), fullPage: full });
    await hscroll(name);
  };
  // START_QS: a shared link (?s=…&m=p&k=…) — the title page offers that birth (PROJECT_PLAN §11.23)
  await page.goto(URL + (process.env.START_QS || ''), { waitUntil: 'load' });
  await sleep(600);
  await shot('01_intro');
  await shot('01_intro_full', true);
  // MODE=potential: the potential mode is chosen on the title page (PROJECT_PLAN §11.20)
  if (process.env.MODE === 'potential') {
    await page.click('.modeseg button:text-is("ポテンシャルモード")');
    await shot('01b_intro_potential', true);
  }
  await page.click('button:text-is("約5分")');
  if (process.env.START_QS) await page.click('.sharedbirth .btn.primary');
  else await page.click(w === 390 ? '.sticky-cta button' : '.cta-row .btn.cta');
  if (process.env.MODE === 'potential' && !process.env.START_QS) {
    // the choice of ★ comes before the birth (PROJECT_PLAN §11.21)
    await page.waitForSelector('.starpick', { timeout: 5000 });
    await page.click('.starrow >> nth=' + (Number(process.env.STARS || 10) - 1));
    await sleep(200);
    await shot('01c_starpick');
    await shot('01c_starpick_full', true);
    await page.click('.starpick .cta');
  }
  await sleep(900);
  await shot('02_roll');
  await page.waitForSelector('button:text-is("人生を始める")', { timeout: 20000 });
  await sleep(300);
  await shot('03_cert');
  await shot('03_cert_full', true);
  await page.click('button:text-is("人生を始める")');
  await sleep(2500);
  await shot('04_life_start');
  await page.click('button:text-is("16×")');
  await sleep(6000);
  await shot('05_life_mid');
  // wait for a decision (fast-forward if none is open yet)
  if (!(await page.$('.dialog'))) await page.click(w === 390 ? '.controls button.jp' : 'button:has-text("次の決断まで")', { timeout: 5000 });
  await page.waitForSelector('.dialog', { timeout: 60000 });
  await sleep(400);
  await shot('06_decision');
  checks.decisionTitle = await page.textContent('.dialog h2');
  await page.click('.dialog .choices button >> nth=0');
  await sleep(500);
  // let the next decision come and minimise it once to test the peek bar
  if (!(await page.$('.dialog'))) await page.click(w === 390 ? '.controls button.jp' : 'button:has-text("次の決断まで")', { timeout: 5000 });
  await page.waitForSelector('.dialog', { timeout: 60000 });
  await page.click('.dialog button:has-text("あとで決める")');
  await sleep(300);
  await shot('07_decision_minimised');
  await page.click('.peek button');
  await sleep(200);
  // おまかせ from now on
  await page.click('.dialog button:has-text("これからの決断をおまかせにする")').catch(async () => {
    await page.click('.dialog .choices button >> nth=0');
  });
  await sleep(300);
  if (w === 390 && !(await page.$('.dialog'))) {
    await page.click('.controls button[aria-label="その他の操作"]', { timeout: 5000 }).catch(() => {});
    await sleep(200);
    await shot('08_menu');
    await page.click('.controls button[aria-label="その他の操作"]', { timeout: 5000 }).catch(() => {});
  }
  // breath screens may still appear (they are skipped during fast-forward); wait for the ending
  // (full-page shots on the way: high-school records at 17, work and home at 45)
  const shotAges = [17, 45];
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (await page.$('.ending')) break;
    const age = parseInt((await page.textContent('.agebox .age').catch(() => '')) || '', 10);
    if (shotAges.length && age >= shotAges[0] && !(await page.$('.dialog'))) {
      shotAges.shift();
      await shot(`08_life_age${age}`, true);
      checks[`panelsAt${age}`] = await page.evaluate(() => ({
        records: !!document.querySelector('.recpanel'),
        family: document.querySelector('.col.right .kv')?.innerText.replace(/\s+/g, ' ').slice(0, 300),
      }));
    }
    if (!checks.draftShot && (await page.$('.draftdlg'))) {
      checks.draftShot = true;
      await shot('08b_draft');
      checks.draft = await page.evaluate(() => document.querySelector('.draftdlg')?.innerText.replace(/\s+/g, ' ').slice(0, 500));
    }
    if (!checks.quitShot && (await page.$('#stop-title'))) {
      checks.quitShot = true;
      await shot('08c_quit');
    }
    if (!checks.proShot && (await page.$('.proyears')) && !(await page.$('.dialog'))) {
      checks.proShot = true;
      await shot('08d_life_pro', true);
    }
    // the crossroads at the end of playing (PROJECT_PLAN §11.24): the choices, then the screen after coming back
    if (!checks.crossShot && (await page.$('.dialog')) && /故障|野球部をやめるか/.test((await page.textContent('.dialog h2').catch(() => '')) || '')) {
      checks.crossShot = true;
      checks.crossTitle = await page.textContent('.dialog h2');
      await shot('08e_quitcross');
      await page.click('.dialog .choices button >> nth=0', { timeout: 3000 }).catch(() => {});
      await sleep(1500);
      await shot('08f_after_cross');
      continue;
    }
    const d = await page.$('.dialog .choices button');
    if (d) await d.click({ timeout: 3000 }).catch(() => {});
    else {
      const ff = await page.$(w === 390 ? '.controls button.jp[aria-pressed="false"]' : 'button[aria-pressed="false"]:has-text("次の決断まで")');
      if (ff) await ff.click({ timeout: 3000 }).catch(() => {});
    }
    await sleep(500);
  }
  checks.endingSeconds = (Date.now() - t0) / 1000;
  await sleep(1500);
  await shot('09_ending');
  await page.click('.ending .skip');
  await sleep(1200);
  await shot('10_ending_last');
  await page.click('.ending button:has-text("記録を見る")');
  await sleep(500);
  const t1 = Date.now();
  while (Date.now() - t1 < 120000) {
    const busy = await page.$('text=同じ条件の試行を計算しています');
    if (!busy) break;
    await sleep(500);
  }
  checks.cohortSeconds = (Date.now() - t1) / 1000;
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await shot('11_result');
  await shot('11_result_full', true);
  checks.rarity = await page.evaluate(() => document.querySelector('.rarity')?.innerText.replace(/\s+/g, ' ').slice(0, 400));
  // replay of the last scene from the result, then back to the result
  await page.click('button:has-text("最期の場面をもう一度見る")');
  await sleep(800);
  checks.replayOpened = !!(await page.$('.ending'));
  await shot('11b_replay');
  // (a long life has more scenes to skip)
  for (let k = 0; k < 15 && (await page.$('.ending')); k++) {
    const done = await page.$('.ending button:has-text("記録を見る")');
    if (done) await done.click({ timeout: 3000 }).catch(() => {});
    else await page.click('.ending .skip', { timeout: 3000 }).catch(() => {});
    await sleep(400);
  }
  checks.replayClosed = !(await page.$('.ending'));
  await page.click('.footer-bar button:has-text("共有する")', { timeout: 8000 }).catch((e) => (checks.shareClick = String(e).slice(0, 200)));
  await sleep(600);
  await shot('12_share');
  await page.click('.share button:has-text("閉じる")');
  for (const pg of ['privacy', 'legal', 'feedback']) {
    await page.goto(URL + '#' + pg, { waitUntil: 'load' });
    await sleep(400);
    await shot('14_' + pg, true);
  }
  await page.goto(URL + '#stats', { waitUntil: 'load' });
  await sleep(500);
  await shot('13_stats');
  checks.errors = errors;
  fs.writeFileSync(path.join(OUT, `${w}_checks.json`), JSON.stringify(checks, null, 1));
  await browser.close();
  return checks;
}

for (const w of (process.argv[4] || '1280,390').split(',').map(Number)) {
  try {
    const c = await run(w);
    console.log(w, JSON.stringify({ title: c.decisionTitle, endingSeconds: c.endingSeconds, cohortSeconds: c.cohortSeconds, replay: [c.replayOpened, c.replayClosed], errors: c.errors, hscroll: Object.entries(c).filter(([, v]) => v && v.sw && v.sw > v.cw).map(([k]) => k), panels: Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith('panelsAt'))) }));
  } catch (e) {
    console.log(w, 'FAILED', e.message.split('\n')[0]);
  }
}
