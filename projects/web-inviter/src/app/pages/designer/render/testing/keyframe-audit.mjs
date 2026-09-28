// The keyframe audit's browser half (the pages come from designer/keyframe-audit.spec.ts).
// Loads every page in Chromium at 390px (1 unit = 1px), scrolls to each sample — down the page, then
// back up — and compares what the page shows with what the editor's model says. Runs twice: with
// scroll-driven CSS, and as an old browser (no animation-timeline; the page's script scrubs).
//
// Usage: node keyframe-audit.mjs <cases.json> [native|fallback|both] [name filter]
// Needs playwright-core: PLAYWRIGHT_FROM=<a dir where it's installed>, CHROME=<chromium binary> (optional).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM.replace(/\/?$/, '/') : import.meta.url);
const { chromium } = require('playwright-core');
const [file, mode = 'both', filter = ''] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(file, 'utf8')).filter((c) => c.name.includes(filter));
// An old browser: no CSS.supports for scroll timelines, and animations on the page clock, which the script scrubs.
const oldBrowser = (html) => html.replace('<head>', `<head><script>(function(){var r=CSS.supports.bind(CSS);CSS.supports=function(){return String([].join.call(arguments,' ')).indexOf('animation-timeline')>=0?false:r.apply(null,arguments);};})()</script>`)
  .replace('</head>', '<style>*,*::before,*::after{animation-timeline:auto!important}</style></head>');
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const TOL = { opacity: 0.03, pos: 1.5, blur: 0.25 };
const report = [];
let checked = 0;

for (const m of mode === 'both' ? ['native', 'fallback'] : [mode]) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const FB = m === 'fallback';
  const errors = [];
  for (const k of cases) {
    // A fresh tab each time: a window keeps the scroll listeners of pages written into it before.
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.setContent(FB ? oldBrowser(k.html) : k.html, { waitUntil: 'load' });
    if (m === 'fallback' && !(await p.evaluate(() => document.documentElement.classList.contains('ib-fb')))) {
      report.push({ mode: m, case: k.name, what: 'fallback did not switch on' });
      continue;
    }
    // Down the page, then back up it: what was passed must come back.
    for (const s of [...k.samples, ...[...k.samples].reverse().map((x) => ({ ...x, what: x.what + ' (scrolling back up)' }))]) {
      const got = await p.evaluate(async ({ s }) => {
        window.scrollTo(0, s.scroll);
        // The scroll event, then the old-browser script's frame, then a frame to paint.
        await new Promise((r) => setTimeout(r, 60));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const el = document.querySelector(s.sel);
        if (!el) return null;
        const chain = (n) => { let o = 1; for (let x = n; x; x = x.parentElement) { o *= Number(getComputedStyle(x).opacity); if (x === el) break; } return o; };
        const a = el.querySelector(':scope > .a') ?? el;
        const r = a.getBoundingClientRect();
        const f = getComputedStyle(a).filter;
        const blur = f && f !== 'none' ? parseFloat((f.match(/blur\(([-\d.]+)px\)/) ?? [0, 0])[1]) : 0;
        const pieces = s.pieces ? [...el.querySelectorAll('.p')].map((x) => chain(x)) : null;
        return { scrollY: scrollY, opacity: chain(a), cx: r.left + r.width / 2, cy: r.top + r.height / 2, blur, pieces };
      }, { s });
      checked++;
      if (!got) { report.push({ mode: m, case: k.name, what: s.what, problem: 'element missing' }); continue; }
      const bad = [];
      if (Math.abs(got.scrollY - s.scroll) > 0.5) bad.push(`scrolled to ${got.scrollY} not ${s.scroll}`);
      if (s.pieces) {
        const off = got.pieces.map((o, i) => [i, o]).filter(([, o]) => Math.abs(o - s.expect.opacity) > TOL.opacity);
        if (off.length) bad.push(`pieces ${off.slice(0, 4).map(([i, o]) => `#${i}=${o.toFixed(3)}`).join(' ')}${off.length > 4 ? ` +${off.length - 4}` : ''} of ${got.pieces.length}, want ${s.expect.opacity.toFixed(3)}`);
      } else {
        if (Math.abs(got.opacity - s.expect.opacity) > TOL.opacity) bad.push(`opacity ${got.opacity.toFixed(3)} want ${s.expect.opacity.toFixed(3)}`);
        if (s.expect.cx !== undefined && got.opacity > 0.02 && Math.abs(got.cx - s.expect.cx) > TOL.pos) bad.push(`x ${got.cx.toFixed(1)} want ${s.expect.cx.toFixed(1)}`);
        if (s.expect.cy !== undefined && got.opacity > 0.02 && Math.abs(got.cy - s.expect.cy) > TOL.pos) bad.push(`y ${got.cy.toFixed(1)} want ${s.expect.cy.toFixed(1)}`);
        if (s.expect.blur !== undefined && Math.abs(got.blur - s.expect.blur) > TOL.blur) bad.push(`blur ${got.blur.toFixed(2)} want ${s.expect.blur.toFixed(2)}`);
      }
      if (bad.length) report.push({ mode: m, case: k.name, what: s.what, scroll: s.scroll, problem: bad.join('; ') });
    }
    await p.close();
  }
  if (errors.length) report.push({ mode: m, case: '*', problem: 'page errors: ' + [...new Set(errors)].slice(0, 3).join(' | ') });
  await c.close();
}
await b.close();
writeFileSync(file.replace(/\.json$/, '') + '-report.json', JSON.stringify(report, null, 1));
const byCase = new Map();
for (const r of report) byCase.set(`${r.mode} ${r.case}`, [...(byCase.get(`${r.mode} ${r.case}`) ?? []), r]);
console.log(`${cases.length} pages, ${checked} samples checked, ${report.length} problems in ${byCase.size} page runs`);
for (const [k, rs] of [...byCase].slice(0, 60)) console.log(`${k}: ${rs.map((r) => `[${r.what}${r.scroll !== undefined ? ' @' + r.scroll : ''}] ${r.problem}`).slice(0, 3).join(' || ')}`);
