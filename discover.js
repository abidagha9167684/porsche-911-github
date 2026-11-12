// Section 5: seven small interactive tiles (no extra 3D scene, so it stays fast).
//  Row 1: wheel that spins up · paint mixer (click paints the real 911) · rev counter with engine sound · find the car in the dark
//  Row 2: performance figures that count up · newsletter (demo form) · heritage timeline
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* the paint tile is rendered in this red; CSS hue-rotate() and this function give the same colour */
const BASE = [193, 18, 31]; // #c1121f
function hueRotate(deg) {
  const r = (deg * Math.PI) / 180, a = Math.cos(r), b = Math.sin(r);
  const m = [
    0.213 + 0.787 * a - 0.213 * b, 0.715 - 0.715 * a - 0.715 * b, 0.072 - 0.072 * a + 0.928 * b,
    0.213 - 0.213 * a + 0.143 * b, 0.715 + 0.285 * a + 0.140 * b, 0.072 - 0.072 * a - 0.283 * b,
    0.213 - 0.213 * a - 0.787 * b, 0.715 - 0.715 * a + 0.715 * b, 0.072 + 0.928 * a + 0.072 * b,
  ];
  const [R, G, B] = BASE;
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(m[0] * R + m[1] * G + m[2] * B) + c(m[3] * R + m[4] * G + m[5] * B) + c(m[6] * R + m[7] * G + m[8] * B);
}

const FALLBACK_WHEEL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="#111"/><circle cx="100" cy="100" r="68" fill="#2a2c30"/>' +
  [0, 1, 2, 3, 4].map((i) => `<rect x="94" y="34" width="12" height="66" rx="4" fill="#c9ccd2" transform="rotate(${i * 72} 100 100)"/>`).join('') +
  '<circle cx="100" cy="100" r="16" fill="#c9ccd2"/></svg>');

// start years as commonly quoted; sources differ by a year for some generations
const ERAS = [
  { year: 1963, code: 'Original 911', text: 'First shown in Frankfurt as the 901. Air-cooled flat-six in the back.' },
  { year: 1973, code: 'G-series', text: 'Impact bumpers, and the first 911 Turbo follows soon after.' },
  { year: 1988, code: '964', text: 'Heavily re-engineered, with all-wheel drive in the Carrera 4.' },
  { year: 1993, code: '993', text: 'The last of the air-cooled 911s.' },
  { year: 1997, code: '996', text: 'A new start: the first water-cooled 911.' },
  { year: 2004, code: '997', text: 'The round headlights return.' },
  { year: 2011, code: '991', text: 'A new platform with a longer wheelbase.' },
  { year: 2018, code: '992', text: 'Wider body and a light bar across the tail.' },
];

export function initDiscover(api) {
  const section = document.getElementById('discover');
  if (!section) return;
  const q = (s) => section.querySelector(s);

  // rows fade in when they scroll into view
  section.querySelectorAll('.dgrid').forEach((g) =>
    new IntersectionObserver(([e]) => { if (e.isIntersecting) g.classList.add('in'); }, { threshold: 0.15 }).observe(g));

  // pictures of the 3D car, made once shortly before the section appears
  let filled = false;
  function fill() {
    if (filled) return;
    filled = true;
    let snaps = {}, tiles = {};
    try { snaps = api.getSnapshots() || {}; } catch (err) { console.error('Snapshots failed:', err); }
    try { tiles = api.getTileShots() || {}; } catch (err) { console.error('Tile pictures failed:', err); }
    const set = (sel, src) => { if (src) section.querySelectorAll(sel).forEach((im) => (im.src = src)); };
    set('.wheel-img', tiles.wheel || FALLBACK_WHEEL);
    set('.paint-img', tiles.paint || snaps.front34);
    set('.spot-img', snaps.front34);
    set('.perf-img', snaps.side);
    set('.news-img', snaps.rear34);
    set('.her-img', snaps.side);
  }
  new IntersectionObserver(([e]) => { if (e.isIntersecting) fill(); }, { rootMargin: '700px 0px' }).observe(section);
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(section);

  function hover(el, fn) {
    let on = false;
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') fn((on = true)); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') fn((on = false)); });
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') fn((on = !on)); });
  }

  /* ---------- 1) wheel ---------- */
  const wheel = { img: q('.wheel-img'), kmh: q('#wheelKmh'), w: 1.2, target: 1.2, rot: 0 };
  hover(q('#tWheel'), (on) => (wheel.target = on ? 24 : 1.2));

  /* ---------- 2) paint mixer ---------- */
  const paint = { el: q('#tPaint'), img: q('.paint-img'), dot: q('#paintDot'), hint: q('#paintHint'), deg: 0, hovered: false, locked: false, hex: hueRotate(0) };
  q('.paint-bar').style.background = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => hueRotate(i * 30)).join(', ')})`;
  function setPaintDeg(deg) {
    paint.deg = ((deg % 360) + 360) % 360;
    paint.hex = hueRotate(paint.deg);
    paint.img.style.filter = `hue-rotate(${paint.deg.toFixed(1)}deg)`;
    paint.dot.style.left = (paint.deg / 360) * 100 + '%';
    paint.dot.style.background = paint.hex;
  }
  setPaintDeg(0);
  paint.el.addEventListener('pointermove', (e) => {
    const r = paint.el.getBoundingClientRect();
    paint.hovered = true;
    setPaintDeg(clamp((e.clientX - r.left) / r.width, 0, 0.999) * 360);
  });
  paint.el.addEventListener('pointerleave', () => { paint.hovered = false; });
  paint.el.addEventListener('click', () => {
    api.setPaint(paint.hex);                    // paints the real 3D car at the top of the page
    paint.locked = true;
    paint.hint.textContent = 'Painted. Scroll up to see your 911';
    paint.el.classList.remove('done');
    void paint.el.offsetWidth;
    paint.el.classList.add('done');
  });

  /* ---------- 3) rev counter ---------- */
  const rev = { el: q('#tRev'), needle: q('#revNeedle'), num: q('#revNum'), shown: 0 };
  let ticks = '';
  for (let i = 0; i <= 40; i++) {
    const a = ((-120 + i * 6) * Math.PI) / 180, major = i % 5 === 0, red = i >= 34;
    const r0 = major ? 53 : 58, r1 = 62;
    const x0 = 100 + r0 * Math.sin(a), y0 = 92 - r0 * Math.cos(a), x1 = 100 + r1 * Math.sin(a), y1 = 92 - r1 * Math.cos(a);
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${red ? '#ff2d2d' : major ? '#fff' : '#70737a'}" stroke-width="${major ? 1.8 : 1}"/>`;
    if (major) {
      const xl = 100 + 45 * Math.sin(a), yl = 92 - 45 * Math.cos(a) + 2.8;
      ticks += `<text x="${xl.toFixed(1)}" y="${yl.toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="${red ? '#ff5a5a' : '#d8d9de'}" font-family="Segoe UI, Arial, sans-serif">${i / 5}</text>`;
    }
  }
  q('#revTicks').innerHTML = ticks;
  rev.el.addEventListener('click', () => { api.rev(); });

  /* ---------- 4) find the car in the dark ---------- */
  const spot = { el: q('#tSpot'), x: 30, y: 50, tx: null, ty: null };
  spot.el.addEventListener('pointermove', (e) => {
    const r = spot.el.getBoundingClientRect();
    spot.tx = ((e.clientX - r.left) / r.width) * 100;
    spot.ty = ((e.clientY - r.top) / r.height) * 100;
  });
  spot.el.addEventListener('pointerleave', () => { spot.tx = spot.ty = null; });

  /* ---------- 5) performance figures: count up when the tile comes into view, and again on hover ---------- */
  const perf = { el: q('#tPerf'), items: [...section.querySelectorAll('.perf-num')], t: 0, running: false };
  const startPerf = () => {
    perf.t = 0;
    perf.running = true;
    perf.el.classList.remove('go');
    void perf.el.offsetWidth;
    perf.el.classList.add('go');
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) startPerf(); }, { threshold: 0.6 }).observe(perf.el);
  perf.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') startPerf(); });

  /* ---------- 6) newsletter (demo: nothing is sent) ---------- */
  const news = q('#tNews'), form = q('#newsForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
      news.classList.remove('shake');
      void news.offsetWidth;
      news.classList.add('shake');
      input.focus();
      return;
    }
    news.classList.add('sent');
  });

  /* ---------- 7) heritage ---------- */
  const her = { year: q('#herYear'), code: q('#herCode'), text: q('#herText'), img: q('.her-img'), range: q('#herRange'), idx: 0, shown: ERAS[0].year, auto: true, autoT: 0 };
  function setEra(i) {
    her.idx = i;
    her.range.value = i;
    her.code.textContent = ERAS[i].code;
    her.text.textContent = ERAS[i].text;
    const g = 1 - i / (ERAS.length - 1);       // older = more "old photo"
    her.img.style.filter = `grayscale(${g.toFixed(2)}) sepia(${(g * 0.6).toFixed(2)}) contrast(${(1 + g * 0.15).toFixed(2)})`;
  }
  setEra(0);
  her.range.addEventListener('input', () => { her.auto = false; setEra(Number(her.range.value)); });
  her.range.addEventListener('pointerdown', () => { her.auto = false; });

  /* ---------- one light loop for everything, only while the section is on screen ---------- */
  let last = performance.now(), t = 0;
  function update(dt) {
    // wheel
    wheel.w += (wheel.target - wheel.w) * (1 - Math.exp(-1.6 * dt));
    wheel.rot = (wheel.rot + (wheel.w * dt * 180) / Math.PI) % 360;
    wheel.img.style.transform = `rotate(${wheel.rot.toFixed(1)}deg)`;
    wheel.kmh.textContent = Math.round(clamp((wheel.w - 1.2) / 22.8, 0, 1) * 300);

    // paint: drifts through the colours until you choose one
    if (!paint.hovered && !paint.locked) setPaintDeg(paint.deg + dt * 24);

    // rev counter follows the real engine
    const rpm = api.getRpm() || 0;
    rev.shown += (rpm - rev.shown) * (1 - Math.exp(-12 * dt));
    rev.needle.setAttribute('transform', `rotate(${(-120 + 240 * clamp(rev.shown / 8000, 0, 1)).toFixed(1)} 100 92)`);
    rev.num.textContent = Math.round(rev.shown / 10) * 10;
    rev.el.classList.toggle('hot', rev.shown > 6000);
    rev.el.classList.toggle('on', rev.shown > 100);

    // spotlight
    const gx = spot.tx ?? 50 + 36 * Math.sin(t * 0.6), gy = spot.ty ?? 52 + 20 * Math.sin(t * 0.9 + 1);
    spot.x += (gx - spot.x) * 0.14; spot.y += (gy - spot.y) * 0.14;
    spot.el.style.setProperty('--mx', spot.x.toFixed(1) + '%');
    spot.el.style.setProperty('--my', spot.y.toFixed(1) + '%');

    // performance figures count up
    if (perf.running) {
      perf.t += dt;
      const k = clamp(perf.t / 1.6, 0, 1), e = 1 - Math.pow(1 - k, 3);
      perf.items.forEach((el) => {
        const to = Number(el.dataset.to), from = Number(el.dataset.from || 0), dec = Number(el.dataset.dec || 0);
        el.textContent = (from + (to - from) * e).toFixed(dec);
      });
      if (k >= 1) perf.running = false;
    }

    // heritage: steps through the generations by itself until you take the slider
    if (her.auto) {
      her.autoT += dt;
      if (her.autoT > 2.8) { her.autoT = 0; setEra((her.idx + 1) % ERAS.length); }
    }
    her.shown += (ERAS[her.idx].year - her.shown) * (1 - Math.exp(-7 * dt));
    her.year.textContent = Math.round(her.shown);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible) return;
    t += dt;
    try { update(dt); } catch (err) {
      if (!frame.failed) { frame.failed = true; console.error('Discover section error:', err); }
    }
  }
  requestAnimationFrame(frame);
}
