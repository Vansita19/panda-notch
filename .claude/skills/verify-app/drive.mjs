// Drives the built About page in real Chromium. Usage:
//   PW_DIR=/tmp/pw node .claude/skills/verify-app/drive.mjs [outDir]
// PW_DIR is a directory where `npm i playwright && npx playwright install chromium` was run (outside the repo).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://127.0.0.1:4321/';
const out = process.argv[2] || '/tmp/about-evidence';
mkdirSync(out, { recursive: true });
const expectedHrefs = {
  'View portfolio': 'https://vansita.design/',
  'Pitch Protocol': 'https://vansita.design/',
  'TurboML': 'https://vansita.design/',
  'Growth Factory Ventures': 'https://contra.com/p/AQcLYsEg-growth-factory-ventures-brand-identity-and-website-design',
  'Portfolio': 'https://vansita.design/',
  'LinkedIn': 'https://www.linkedin.com/in/vansita/',
};
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const browser = await chromium.launch();
for (const [w, h] of [[360, 800], [768, 1024], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const logs = [], failed = [], external = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', e => logs.push(String(e)));
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('request', r => { if (!r.url().startsWith(new URL(BASE).origin) && !r.url().startsWith('data:')) external.push(r.url()); });
  const res = await page.goto(BASE, { waitUntil: 'networkidle' });
  ok(res.status() === 200, `${w}: HTTP 200`);
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    h1: document.querySelectorAll('h1').length,
    body: parseFloat(getComputedStyle(document.body).fontSize),
    small: [...document.querySelectorAll('a')].filter(a => { const r = a.getBoundingClientRect(); return r.height < 43.5 && !a.classList.contains('skip') && r.width > 0; }).map(a => a.textContent.trim() + ' ' + Math.round(a.getBoundingClientRect().height)),
    wrap: document.querySelector('.hero').getBoundingClientRect().width,
  }));
  ok(m.sw <= m.iw, `${w}: no horizontal overflow (scrollWidth ${m.sw} <= ${m.iw})`);
  ok(m.h1 === 1, `${w}: one h1`);
  ok(m.body >= 16, `${w}: body ${m.body}px`);
  ok(m.small.length === 0, `${w}: tap targets >=44px ${m.small.join('; ')}`);
  ok(logs.length === 0, `${w}: console clean ${logs.join(' | ')}`);
  ok(failed.length === 0, `${w}: no failed requests ${failed.join(' ')}`);
  ok(external.length === 0, `${w}: no third-party requests ${external.join(' ')}`);
  await page.screenshot({ path: `${out}/about-${w}-viewport.png` });
  await page.screenshot({ path: `${out}/about-${w}-full.png`, fullPage: true });
  if (w === 1440) {
    ok(Math.round(m.wrap) <= 1120 + 96 + 1, `1440: content width ${Math.round(m.wrap)}`);
    // links
    for (const [name, href] of Object.entries(expectedHrefs)) {
      const a = page.locator(`a:has-text("${name}")`).first();
      const h = await a.getAttribute('href'), t = await a.getAttribute('target'), r = await a.getAttribute('rel');
      ok(h === href && t === '_blank' && r === 'noopener noreferrer', `link ${name} -> ${h}`);
    }
    // anchors
    for (const id of ['work', 'approach', 'contact']) {
      await page.click(`nav a[href="#${id}"]`);
      await page.waitForTimeout(600);
      const top = await page.evaluate(i => ({ t: document.getElementById(i).getBoundingClientRect().top, hh: document.querySelector('.site-header').getBoundingClientRect().height }), id);
      ok(top.t >= top.hh - 2 && top.t < top.hh + 340, `anchor #${id} lands below header (top ${Math.round(top.t)}, header ${Math.round(top.hh)})`);
    }
    // keyboard focus
    await page.goto(BASE); await page.evaluate(() => scrollTo(0, 0));
    let seen = 0, visible = 0;
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { s: e.textContent.trim().slice(0, 20), o: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }; });
      if (f) { seen++; if (f.o) visible++; }
    }
    ok(seen > 0 && seen === visible, `keyboard focus visible on ${visible}/${seen} tab stops`);
    await page.keyboard.press('Shift+Tab'); 
    await page.screenshot({ path: `${out}/about-1440-focus.png` });
  }
  await ctx.close();
}
// reduced motion
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(BASE);
const rm = await page.evaluate(() => ({ a: getComputedStyle(document.querySelector('h1')).animationName, s: getComputedStyle(document.documentElement).scrollBehavior }));
ok(rm.a === 'none' && rm.s === 'auto', `reduced motion neutralised (animation ${rm.a}, scroll ${rm.s})`);
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
