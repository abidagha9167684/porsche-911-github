// Video tour: open the site with ?demo at the end of the address (or double-click record-video.bat).
// "Record video" plays an automatic tour through the whole page and saves it as a video file (for LinkedIn etc.).
// "Play tour only" just plays the tour (use it with any screen recorder).
const AUTHOR = '';   // put your name here, e.g. 'Built by Your Name' (shown on the end card); leave empty for no name
const SPEED = 1.35;  // tour speed: 1 = original pace, higher = faster (try 1.2 to 1.6)
const TITLE = 'Interactive 3D website concept';
const TECH = 'Unreal Engine 5 · Three.js · WebGL · Web Audio · HTML · CSS · JavaScript';

if (new URLSearchParams(location.search).has('demo')) setup();

function setup() {
  const hold = (ms) => new Promise((r) => setTimeout(r, ms));   // real time (for animations that have their own pace)
  const sleep = (ms) => hold(ms / SPEED);
  const $ = (id) => document.getElementById(id);

  const style = document.createElement('style');
  style.textContent = `
    .demo-panel { position: fixed; right: 18px; bottom: 18px; z-index: 600; width: 340px; padding: 16px 18px; border-radius: 6px;
      background: rgba(12,12,16,.95); color: #fff; border: 1px solid rgba(255,255,255,.22); font: 13px/1.5 "Segoe UI", system-ui, sans-serif; }
    .demo-panel h5 { font-size: 15px; margin: 0 0 8px; }
    .demo-panel ol { margin: 0 0 12px 18px; padding: 0; color: #c9cbd1; }
    .demo-panel button { font: inherit; font-weight: 700; padding: 10px 14px; margin: 0 8px 8px 0; border: 0; border-radius: 3px; cursor: pointer; }
    .demo-panel button:disabled { opacity: .45; cursor: default; }
    .demo-rec { background: #e10600; color: #fff; }
    .demo-play { background: #fff; color: #000; }
    .demo-status { color: #ffd27a; min-height: 18px; }
    .demo-running .demo-panel { display: none; }
    .demo-running, .demo-running * { cursor: none !important; }
    .demo-cursor { position: fixed; left: 0; top: 0; z-index: 700; pointer-events: none; opacity: 0; transition: opacity .3s; will-change: transform;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)); }
    .demo-cursor.show { opacity: 1; }
    .demo-cursor svg { display: block; transition: transform .12s; transform-origin: 5px 3px; }
    .demo-cursor.down svg { transform: scale(.8); }
    .demo-cursor i { position: absolute; left: 5px; top: 3px; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 2px solid #fff; opacity: 0; }
    .demo-cursor.rip i { animation: demoRip .5s ease-out; }
    @keyframes demoRip { from { opacity: .95; transform: scale(.2); } to { opacity: 0; transform: scale(1.25); } }
    .demo-cap { position: fixed; left: 50%; top: 84px; transform: translateX(-50%); z-index: 550; padding: 9px 20px; border-radius: 999px;
      background: rgba(8,8,11,.74); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.18); color: #fff;
      font: 600 15px/1.3 "Segoe UI", system-ui, sans-serif; letter-spacing: .03em; white-space: nowrap; opacity: 0; transition: opacity .4s; pointer-events: none; }
    .demo-cap.show { opacity: 1; }
    .demo-card { position: fixed; inset: 0; z-index: 560; background: #050507; color: #fff; display: grid; place-content: center; justify-items: center;
      text-align: center; gap: 14px; opacity: 0; visibility: hidden; transition: opacity .7s, visibility .7s; font-family: "Segoe UI", system-ui, sans-serif; }
    .demo-card.show { opacity: 1; visibility: visible; }
    .demo-card .big { font-size: clamp(120px, 20vw, 300px); font-weight: 900; line-height: .9; letter-spacing: -.04em; color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.85); }
    .demo-card .line { width: min(420px, 60vw); height: 3px; background: #ff1a1a; box-shadow: 0 0 14px 2px rgba(255,30,30,.9), 0 0 60px 10px rgba(255,30,30,.45); }
    .demo-card h3 { font-size: clamp(22px, 2.6vw, 40px); font-weight: 800; margin: 6px 0 0; }
    .demo-card p { font-size: clamp(13px, 1.2vw, 18px); color: #c9cbd1; margin: 0; letter-spacing: .04em; }
    .demo-card small { font-size: 12px; color: #7d7f86; margin-top: 10px; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'demo-panel';
  panel.innerHTML = `
    <h5>Make a video of this site</h5>
    <ol>
      <li>Press F11 for full screen (best quality).</li>
      <li>Click <b>Record video</b>, choose <b>this tab</b> and keep <b>tab audio</b> switched on.</li>
      <li>Do not touch the mouse: the tour shows its own pointer. It takes a bit over a minute, then the video is saved to Downloads.</li>
    </ol>
    <button class="demo-rec" disabled>● Record video</button><button class="demo-play" disabled>▶ Play tour only</button>
    <div class="demo-status">Loading the car…</div>`;
  document.body.appendChild(panel);
  const cap = document.createElement('div');
  cap.className = 'demo-cap';
  const card = document.createElement('div');
  card.className = 'demo-card';
  // an animated mouse pointer that the tour moves around (the real pointer is hidden while the tour runs)
  const cur = document.createElement('div');
  cur.className = 'demo-cursor';
  cur.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2 L4 20 L9 15.5 L12.2 22.5 L15 21.2 L11.8 14.3 L18.5 14.3 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg><i></i>';
  document.body.append(cap, card, cur);
  const recBtn = panel.querySelector('.demo-rec'), playBtn = panel.querySelector('.demo-play'), statusEl = panel.querySelector('.demo-status');
  const status = (t) => (statusEl.textContent = t);

  // the buttons unlock once the car has arrived
  (async () => {
    while (!(window.__site && window.__site.isReady())) await sleep(300);
    recBtn.disabled = playBtn.disabled = false;
    status('Ready.');
  })();

  /* ---------- helpers ---------- */
  function caption(text) {
    if (!text) { cap.classList.remove('show'); return; }
    cap.classList.remove('show');
    setTimeout(() => { cap.textContent = text; cap.classList.add('show'); }, 250);
  }
  function showCard(html) { card.innerHTML = html; card.classList.add('show'); }
  const hideCard = () => card.classList.remove('show');
  const topOf = (el) => el.getBoundingClientRect().top + window.scrollY;
  function scrollToY(y, ms) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    y = Math.max(0, Math.min(max, y));
    ms /= SPEED;
    return new Promise((res) => {
      const y0 = window.scrollY, t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        window.scrollTo({ top: y0 + (y - y0) * e, behavior: 'instant' });
        if (k < 1) requestAnimationFrame(step); else res();
      })(performance.now());
    });
  }
  let cx = window.innerWidth * 0.72, cy = window.innerHeight * 0.62;
  function place(x, y) { cx = x; cy = y; cur.style.transform = `translate(${(x - 5).toFixed(1)}px, ${(y - 3).toFixed(1)}px)`; }
  function moveTo(x, y, ms = 750) {
    ms /= SPEED;
    return new Promise((res) => {
      const x0 = cx, y0 = cy, t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        place(x0 + (x - x0) * e, y0 + (y - y0) * e);
        if (k < 1) requestAnimationFrame(step); else res();
      })(performance.now());
    });
  }
  function moveToEl(el, fx = 0.5, fy = 0.5, ms = 750) {
    if (!el) return Promise.resolve();
    const r = el.getBoundingClientRect();
    return moveTo(r.left + r.width * fx, r.top + r.height * fy, ms);
  }
  async function press() {
    cur.classList.remove('rip');
    void cur.offsetWidth;
    cur.classList.add('rip', 'down');
    await sleep(150);
    cur.classList.remove('down');
  }
  // move the pointer onto something and click it
  async function clickOn(el, fx = 0.5, fy = 0.5) {
    if (!el) return;
    await moveToEl(el, fx, fy);
    await press();
    el.click();
  }
  // "drag" across the car: the camera turns round it
  async function dragOrbit(totalRad, ms) {
    const r = $('hero').getBoundingClientRect();
    const x0 = r.left + r.width * 0.78, x1 = r.left + r.width * 0.22, y = r.top + r.height * 0.52;
    await moveTo(x0, y, 700);
    ms /= SPEED;
    cur.classList.add('down');
    await new Promise((res) => {
      const t0 = performance.now();
      let prev = 0;
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        window.__site.orbitBy((e - prev) * totalRad);
        prev = e;
        place(x0 + (x1 - x0) * e, y);
        if (k < 1) requestAnimationFrame(step); else res();
      })(performance.now());
    });
    cur.classList.remove('down');
  }
  const pe = (el, type, x = 0, y = 0) => el && el.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', bubbles: true, clientX: x, clientY: y }));
  // moves a "virtual mouse" across an element (from/to are fractions of its width)
  function sweep(el, from, to, fy, ms) {
    if (!el) return Promise.resolve();
    ms /= SPEED;
    return new Promise((res) => {
      const t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const r = el.getBoundingClientRect();
        const sx = r.left + r.width * (from + (to - from) * k), sy = r.top + r.height * fy;
        place(sx, sy);
        pe(el, 'pointermove', sx, sy);
        if (k < 1) requestAnimationFrame(step); else res();
      })(performance.now());
    });
  }
  async function waitFor(fn, ms) {
    const t0 = performance.now();
    while (!fn() && performance.now() - t0 < ms) await sleep(100);
  }

  /* ---------- the tour ---------- */
  async function tour() {
    const root = document.documentElement;
    const site = window.__site;
    root.classList.add('demo-running');
    root.style.scrollBehavior = 'auto';
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
      showCard(`<div class="big">911</div><div class="line"></div><h3>${TITLE}</h3><p>${TECH}</p>`);
      await sleep(2000);
      site.replayIntro();
      hideCard();
      caption('The car drifts in · real-time 3D in the browser');
      await waitFor(() => site.isReady(), 12000);
      await sleep(600);

      cur.classList.add('show');
      caption('Start engine · sound and smoke are generated in code');
      await clickOn($('startBtn'));
      await sleep(2400);

      caption('Drag to look around · full 360°');
      await dragOrbit(Math.PI * 2, 7000);            // one full turn round the car
      await sleep(500);

      caption('');
      await clickOn($('startBtn'));                 // engine off
      await sleep(1600);

      caption('Scroll · the headlights switch on');
      await scrollToY(topOf($('drive')), 2600);
      await sleep(700);
      await scrollToY(topOf($('drive')) + $('drive').offsetHeight - window.innerHeight, 4200);
      await sleep(1500);

      caption('Moving-light emblem · flip-book magazine · exploded view');
      await scrollToY(topOf($('cards')), 2000);
      await sleep(600);
      await clickOn($('bookOpen'));
      await hold(3900);                             // the magazine opens and turns its pages at its own pace
      await clickOn(document.querySelector('.book-close'));
      await sleep(400);
      const xray = document.querySelector('.card-xray .card-media');
      await moveToEl(xray);
      pe(xray, 'pointerenter');
      await sleep(2600);
      pe(xray, 'pointerleave');
      await sleep(300);

      caption('Hover · the tail lights switch on');
      await scrollToY(topOf($('finder')), 2000);
      await sleep(900);
      await moveToEl($('finderCars'), 0.55, 0.5);
      pe($('finderCars'), 'pointerenter');
      await sleep(2800);
      pe($('finderCars'), 'pointerleave');

      caption('Seven interactive tiles');
      await scrollToY(topOf($('discover')) - 110, 2000);
      await moveToEl($('tWheel'));
      pe($('tWheel'), 'pointerenter');
      await sleep(1800);
      pe($('tWheel'), 'pointerleave');
      await moveToEl($('tPaint'), 0.05, 0.5, 600);
      await sweep($('tPaint'), 0.05, 0.85, 0.5, 2600);
      pe($('tPaint'), 'pointerleave');
      await moveToEl($('tSpot'), 0.15, 0.5, 700);
      await sweep($('tSpot'), 0.15, 0.85, 0.5, 2400);
      pe($('tSpot'), 'pointerleave');

      await scrollToY(topOf(document.querySelector('.dgrid-3')) - 150, 1600);
      await moveToEl($('tPerf'), 0.5, 0.45);
      pe($('tPerf'), 'pointerenter');
      await sleep(2000);
      // drag the heritage slider through the generations
      const range = $('herRange');
      await moveToEl(range, 0.02, 0.5);
      cur.classList.add('down');
      for (let i = 0; i <= 7; i++) {
        range.value = i;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        await moveToEl(range, 0.02 + 0.96 * (i / 7), 0.5, 380);
      }
      cur.classList.remove('down');
      await sleep(900);

      caption('');
      await scrollToY(1e9, 2200);
      await moveToEl(document.querySelector('.to-top'), 0.8, 0.5, 900);
      await sleep(1500);
      cur.classList.remove('show');
      showCard(`<div class="big">911</div><div class="line"></div><h3>${TITLE}</h3><p>${TECH}</p>${AUTHOR ? `<p>${AUTHOR}</p>` : ''}
        <small>Unofficial concept project. Not affiliated with or endorsed by Porsche AG.</small>`);
      await sleep(3800);
    } finally {
      caption('');
      hideCard();
      cur.classList.remove('show', 'down');
      root.classList.remove('demo-running');
      root.style.scrollBehavior = '';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  /* ---------- recording ---------- */
  async function record() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
      status('This browser cannot record. Use "Play tour only" with a screen recorder.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60 }, cursor: 'never' },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      });
    } catch (err) {
      status('Recording was cancelled or blocked (' + err.name + ').');
      return;
    }
    const mime = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m));
    const opts = { videoBitsPerSecond: 10000000 };
    if (mime) opts.mimeType = mime;
    const rec = new MediaRecorder(stream, opts);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => (rec.onstop = res));
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
    const hasAudio = stream.getAudioTracks().length > 0;
    await sleep(600);
    rec.start(1000);
    try { await tour(); } finally { if (rec.state !== 'inactive') rec.stop(); }
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `911-website-demo.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    status(`Saved 911-website-demo.${ext} to Downloads (${(blob.size / 1e6).toFixed(1)} MB${hasAudio ? '' : ', no sound: tab audio was off'}).`);
  }

  recBtn.addEventListener('click', async () => {
    recBtn.disabled = playBtn.disabled = true;
    try { await record(); } catch (err) { console.error(err); status('Something went wrong: ' + err.message); }
    recBtn.disabled = playBtn.disabled = false;
  });
  playBtn.addEventListener('click', async () => {
    recBtn.disabled = playBtn.disabled = true;
    try { await tour(); } catch (err) { console.error(err); status('Something went wrong: ' + err.message); }
    recBtn.disabled = playBtn.disabled = false;
  });
}
