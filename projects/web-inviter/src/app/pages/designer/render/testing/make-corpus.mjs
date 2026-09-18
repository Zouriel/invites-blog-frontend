// node make-corpus.mjs <count> <seed> > scenes.json
// Scenes for the renderer parity tests: hand-written edge cases, then seeded random scenes that reach
// every element type, option and awkward value the compiler has a branch for. The C# side compiles
// them (DesignParityExportTests), the TypeScript side must produce the same pages.
const [count = '60', seed = '7'] = process.argv.slice(2);

let s = Number(seed) >>> 0 || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (list) => list[Math.floor(rnd() * list.length)];
const maybe = (p = 0.5) => rnd() < p;
/** Numbers that land on rounding boundaries as well as ordinary ones. */
const awkward = [0, 0.0005, 0.0015, 0.0025, 1.0005, 2.5e-3, 12.3455, -0.0005, -12.3455, 0.1 + 0.2, 1 / 3, 2 / 3, 99.9995, 1e-7, 123456.7894, -3.5, 7.125];
const numv = (a, b) => (maybe(0.2) ? pick(awkward) * (maybe() ? 1 : 100) : Math.round((a + rnd() * (b - a)) * 1000) / 1000 + (maybe(0.3) ? 0.00049 : 0));

const texts = ['Hana & Imran', 'We’d love you there', 'café au lait — «ça va»', 'Ünïcødé ©®™ ½ ¾ ° ± ×', 'emoji 🎉✨ and 𝒻𝒶𝓃𝒸𝓎', '<b>not</b> markup & "quotes" \'single\'',
  '  spaces  around  ', 'line\nbreak', 'tab\there', 'non breaking', 'nelchar', 'bom﻿char', 'x'.repeat(4100), ''];
const colours = [null, 'theme:accent', 'theme:bg', 'theme:text', 'theme:rose', 'theme:missing', '#abc', '#ABCDEF', '#abcd', '#12345678', '#xyz', 'red', 'none', 'transparent', '', '  ', 'theme:Bad', 'url(x)'];
const fonts = [null, 'theme:heading-font', 'theme:body-font', 'theme:nope', 'playfair-display', 'great-vibes', 'inter', 'not-a-font', ''];
const easings = [null, 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.1, 0.7, 1.0, 0.1)', 'cubic-bezier(.17,.67,.83,.67)', 'cubic-bezier(1.5,0,0,1)', 'cubic-bezier( 0 , -2.5 , 1 , 3.25 )', 'bounce', ' ease-out ', ''];
const vars = ['guest.name', 'event.title', 'event.subtitle', 'event.description', 'event.date', 'event.time', 'event.venue.name', 'event.venue.address', 'event.hashtag', 'inviter.name', 'event.coverImage', 'event.custom1', 'event.giftNote', 'nope.nothing', ' event.title ', ''];
const slotPaths = ['event.coverImage', 'event.couplePhoto', 'event.gallery', 'event.bride photo', 'event.', 'event.9lives', 'other.path', null, ' event.gallery ', 'event.gallery.2'];
const linkPaths = ['camera.link', 'photos.link', 'event.venue.mapLink', 'event.giftLink', 'rsvp.link', 'javascript:alert(1)', '', null, ' camera.link '];

const svgs = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0L100 50" fill="#C0A060" stroke="navy"/><circle cx="10" cy="10" r="5" style="fill: rgb(255, 0, 0); stroke-width: 2"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40px" height="20"><defs><linearGradient id="g1"><stop offset="0" stop-color="gold"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="40" height="20" fill="url(#g1)"/><use xlink:href="#g1"/><!-- comment --><script>alert(1)</script><foreignObject><div/></foreignObject></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0,24,24"><g>\n  <text x="1" y="12" fill="currentColor">Hi <tspan fill="#0f0">there</tspan> &amp; you</text>\n  <path d="M1 1" fill="var(--c0, #aabbcc)" onclick="x()"/>\n</g><image href="http://evil/x.png"/><rect fill="url(http://evil)" x="0"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#abc" style="fill:#abc;opacity:.5;behavior:url(x)"/><rect id="bad id" fill="rgba(1,2,3,0.5)"/></svg>',
  '<svg viewBox="0 0 -5 5"><path d="M0 0" fill="black"/></svg>',
  'not an svg at all',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><![CDATA[junk]]><text><![CDATA[cdata text]]></text></svg>',
];
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const images = [png, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==', 'data:image/png;base64,bad"base64)', 'data:text/html;base64,PHNjcmlwdD4=', ''];

let nextId = 0;
const id = () => `e${(nextId++).toString(36)}`;

function typography() {
  const t = {};
  if (maybe(0.8)) t.font = pick(fonts);
  if (maybe(0.8)) t.size = pick([18, 0, 4, 401, 12.3455, 48, -5, 1e6]);
  if (maybe(0.7)) t.weight = pick([100, 400, 450, 600, 700, 950, 0, 50, -120]);
  if (maybe(0.5)) t.italic = maybe();
  if (maybe(0.8)) t.color = pick(colours);
  if (maybe(0.8)) t.align = pick(['left', 'center', 'right', 'justify', null]);
  if (maybe(0.6)) t.valign = pick(['top', 'middle', 'bottom', null]);
  if (maybe(0.6)) t.lineHeight = pick([1.3, 0.5, 4.5, 1.2345, 1.0005]);
  if (maybe(0.6)) t.letterSpacing = pick([0, 0.05, -0.3, 2.5, 0.0005, 0.1234]);
  if (maybe(0.4)) t.uppercase = maybe();
  return t;
}

function keyframes() {
  const n = pick([0, 0, 1, 2, 3, 5, 26]);
  const list = [];
  for (let i = 0; i < n; i++) {
    const k = { t: pick([0, 1, 0.5, rnd(), -0.2, 1.4, 0.15, 0.15, 0.500001]) };
    if (maybe()) k.x = numv(-100, 400);
    if (maybe()) k.y = numv(-100, 2000);
    if (maybe(0.4)) k.rotate = pick([0, 15, -370, 3700, 0.0004]);
    if (maybe(0.4)) k.scale = pick([1, 0.5, 1.0004, 25, 0]);
    if (maybe(0.5)) k.opacity = pick([0, 0.5, 1, 1.5, -0.2]);
    if (maybe(0.3)) k.lift = pick([0, 1, 5, 99, 150, -3]);
    if (maybe(0.4)) k.easing = pick(easings);
    list.push(k);
  }
  return list;
}

function base(type) {
  const el = { id: id(), type };
  if (maybe(0.9)) el.x = numv(-50, 400);
  if (maybe(0.9)) el.y = numv(-50, 3000);
  if (maybe(0.9)) el.w = pick([numv(1, 390), 0, -5, 0.4]);
  if (maybe(0.9)) el.h = pick([numv(1, 400), 0, 0.2]);
  if (maybe(0.3)) el.rotate = pick([0, 12.5, -45, 0.0004, 4000]);
  if (maybe(0.3)) el.scale = pick([1, 1.2, 0.0004 + 1, 30]);
  if (maybe(0.3)) el.opacity = pick([1, 0.5, 0, 1.2, -1, 0.9995]);
  if (maybe(0.4)) el.track = pick([null, { start: numv(0, 2000), end: numv(0, 4000) }, { start: 100, end: 50 }, { start: -20, end: 90000 }]);
  el.keyframes = keyframes();
  if (maybe(0.2)) el.pinned = true;
  if (maybe(0.2)) el.block = pick(['Bridesmaids', ' family ', '---', 'Ünï côdé', '', 'a'.repeat(60)]);
  if (maybe(0.2)) el.roleScope = pick(['bride', 'Groom Side', 'nobody', '', null]);
  return el;
}

function element(depth = 0) {
  const type = pick(['text', 'text', 'shape', 'shape', 'svg', 'image', 'slot', 'rsvp', 'link', 'dress', 'group', 'bogus']);
  const el = base(type);
  switch (type) {
    case 'text':
      if (maybe(0.9)) el.text = {
        runs: Array.from({ length: int(0, 4) }, () => (maybe(0.6) ? { text: pick(texts) } : { var: pick(vars) }))
          .map((r) => ({ ...r, ...(maybe(0.3) ? { bold: true } : {}), ...(maybe(0.3) ? { italic: true } : {}) })),
        ...(maybe(0.9) ? { style: typography() } : {}),
      };
      break;
    case 'shape': {
      const kind = pick(['rect', 'ellipse', 'line', 'polygon', 'path', 'blob', null]);
      el.shape = { kind };
      if (maybe(0.8)) el.shape.fill = pick(colours);
      if (maybe(0.6)) el.shape.stroke = pick(colours);
      if (maybe(0.6)) el.shape.strokeWidth = pick([0, 1, 2.5, 500, -1, 0.0005]);
      if (maybe(0.5)) el.shape.radius = pick([0, 6, 999, -2]);
      if (maybe(0.5)) el.shape.sides = pick([3, 5, 6, 12, 2, 40]);
      if (kind === 'path' && maybe(0.9)) {
        el.shape.path = {
          width: pick([100, 0, 20000, 55.5]), height: pick([100, 0.5, 80]),
          contours: Array.from({ length: int(0, 3) }, () => ({
            ...(maybe(0.8) ? { closed: maybe(0.7) } : {}),
            points: Array.from({ length: int(0, 6) }, () => {
              const p = { x: numv(0, 100), y: numv(0, 100) };
              if (maybe(0.3)) p.in = { x: numv(0, 100), y: numv(0, 100) };
              if (maybe(0.3)) p.out = { x: numv(0, 100), y: numv(0, 100) };
              return p;
            }),
          })),
        };
      }
      break;
    }
    case 'svg':
      el.svg = { asset: pick(['svg0', 'svg1', 'svg2', 'svg3', 'svg4', 'svg5', 'svg6', 'img0', 'missing']), fills: {} };
      for (const c of ['#c0a060', '#000080', '#ff0000', '#ffd700', '#ffffff', '#aabbcc', '#00ff00', '#000000', '#aabbcc'])
        if (maybe(0.4)) el.svg.fills[c] = pick(colours);
      break;
    case 'image':
      el.image = { asset: pick(['img0', 'img1', 'img2', 'img3', 'img4', 'svg0', 'missing']) };
      if (maybe()) el.image.fit = pick(['cover', 'contain', 'fill', null]);
      if (maybe()) el.image.radius = pick([0, 8, 12.3455]);
      break;
    case 'slot':
      el.slot = {};
      if (maybe(0.9)) el.slot.path = pick(slotPaths);
      if (maybe(0.7)) el.slot.label = pick(['Photo', 'Bride', '  ', null, 'x'.repeat(80), 'Ünï "q" <b>']);
      if (maybe(0.5)) el.slot.fit = pick(['cover', 'contain', null]);
      if (maybe(0.5)) el.slot.radius = pick([0, 10, 0.0005]);
      if (maybe(0.5)) el.slot.multiple = maybe();
      if (maybe(0.3)) el.slot.min = pick([0, 2, -1, null]);
      if (maybe(0.3)) el.slot.max = pick([0, 9, null]);
      if (maybe(0.4)) el.slot.columns = pick([1, 2, 3, 6, 0, 9]);
      if (maybe(0.4)) el.slot.gap = pick([0, 8, 100, -3, 12.3455]);
      if (maybe(0.4)) el.slot.aspect = pick([1, 0.1, 0.75, 6, 1.3333]);
      if (maybe(0.4)) el.slot.index = pick([null, 0, 1, 2, 50, 51, -1]);
      break;
    case 'rsvp':
    case 'link':
      el.button = {};
      if (type === 'link' && maybe(0.9)) el.button.path = pick(linkPaths);
      if (maybe(0.7)) el.button.label = pick(['Open map', '', '  ', null, 'x'.repeat(100), 'Café & <co>']);
      if (maybe(0.7)) el.button.fill = pick(colours);
      if (maybe(0.5)) el.button.stroke = pick(colours);
      if (maybe(0.5)) el.button.strokeWidth = pick([0, 1, 25, 1.5]);
      if (maybe(0.5)) el.button.radius = pick([999, 0, 12, 2000, -4]);
      if (maybe(0.8)) el.button.style = typography();
      break;
    case 'dress':
      el.dress = {};
      if (maybe()) el.dress.swatch = pick([40, 4, 200, 33.3335]);
      if (maybe()) el.dress.shape = pick(['circle', 'square', null]);
      if (maybe()) el.dress.gap = pick([10, 0, 70]);
      if (maybe(0.7)) el.dress.style = typography();
      break;
    case 'group':
      el.children = depth < 3 ? Array.from({ length: int(0, 4) }, () => element(depth + 1)) : [];
      break;
  }
  return el;
}

function scene() {
  nextId = 0;
  const theme = [
    { key: 'accent', label: 'Accent', value: pick(['#dcaa66', '#DCAA66', 'gold', '#abc']) },
    { key: 'bg', label: 'Background', value: '#1b1019' },
    { key: 'text', label: 'Text', value: '#f7eee3' },
    { key: 'heading-font', label: 'Heading font', value: pick(['playfair-display', 'nope']) },
    { key: 'body-font', label: 'Body font', value: 'inter' },
  ];
  if (maybe()) theme.push({ key: 'rose', label: 'Rose', value: '#d98fa0' });
  if (maybe(0.3)) theme.push({ key: 'Bad Key', label: 'x', value: '#123456' });
  if (maybe(0.3)) theme.push({ key: 'script-font', label: 'Script', value: 'great-vibes' });
  const sc = {
    schema: 3, canvas: {}, theme,
    fonts: pick([[], ['playfair-display', 'inter'], ['great-vibes', 'nope', 'great-vibes'], ['allura']]),
    roles: pick([[], ['Bride', 'Groom Side'], ['bride', '  ', 'Bride'], ['Ünï']]),
    fields: pick([[], [
      { path: 'event.custom1', label: 'Custom one', type: 'text' },
      { path: 'event.giftNote', label: 'Gift, note', type: 'select', options: ['a,b', 'c'], roleScope: 'Bride', sample: 'Sample!' },
      { path: 'event.giftLink', label: 'Gift link', type: 'url' },
      { path: 'event.giftNote', label: 'Duplicate', type: 'textarea' },
      { path: 'event.when', label: 'When', type: 'date', sample: '' },
      { path: '  ', label: 'Blank path', type: 'text' },
    ]]),
    elements: Array.from({ length: int(0, 14) }, () => element()),
    assets: {},
  };
  svgs.forEach((data, i) => { sc.assets[`svg${i}`] = { kind: 'svg', data, width: 10, height: 10 }; });
  images.forEach((data, i) => { sc.assets[`img${i}`] = { kind: 'image', data, width: 1, height: 1 }; });
  return sc;
}

const out = [];
for (let i = 0; i < Number(count); i++) out.push({ name: `random-${seed}-${i}`, scene: scene() });
process.stdout.write(JSON.stringify(out));
