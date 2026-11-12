// Section 3: three tiles
//  1) an original emblem with a light that moves across it (SVG lighting filter)
//  2) a magazine: click it and it opens as a flip-book with pictures of the 3D car and info pages
//  3) "take it apart": the 3D car breaks into its parts when you hover over it
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function initCards({ rig, getSnapshots }) {
  initReveal();
  initEmblem();
  initBook(getSnapshots);
  initXray(rig);
}

/* ------------------------------------------------------------------ reveal on scroll */
function initReveal() {
  const section = document.getElementById('cards');
  if (!section) return;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) section.classList.add('in');
  }, { threshold: 0.15 }).observe(section);
}

/* ------------------------------------------------------------------ 1) emblem with moving light */
function initEmblem() {
  const tile = document.querySelector('.card-emblem .card-media');
  const light = document.getElementById('emblemLight');
  const svg = tile && tile.querySelector('svg');
  if (!tile || !light || !svg) return;
  const glow = tile.querySelector('.emblem-glow');
  // if you put your own logo in /assets (logo.svg / logo.png / logo.webp) it replaces the built-in emblem
  const logoEl = document.getElementById('emblemLogo');
  const original = document.getElementById('emblemOriginal');
  if (logoEl && original) {
    ['assets/logo.svg', 'assets/logo.png', 'assets/logo.webp', 'assets/porsche_logo_PNG1.png']
      .reduce((p, url) => p.then((found) => found || new Promise((res) => {
        const im = new Image();
        im.onload = () => res(url);
        im.onerror = () => res(null);
        im.src = url;
      })), Promise.resolve(null))
      .then((url) => {
        if (!url) return;
        logoEl.setAttribute('href', url);
        logoEl.style.display = '';
        original.style.display = 'none';
        tile.classList.add('has-logo');
      });
  }
  let tx = null, ty = null, lx = 60, ly = 60, visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(tile);
  tile.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 200;
    ty = ((e.clientY - r.top) / r.height) * 240;
  });
  tile.addEventListener('pointerleave', () => { tx = ty = null; });
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = now / 1000;
    const gx = tx ?? 100 + 100 * Math.sin(t * 0.8);          // follows the mouse, otherwise drifts by itself
    const gy = ty ?? 120 + 120 * Math.sin(t * 0.55 + 1);
    lx += (gx - lx) * 0.12; ly += (gy - ly) * 0.12;
    light.setAttribute('x', lx.toFixed(1));
    light.setAttribute('y', ly.toFixed(1));
    glow.style.setProperty('--gx', ((lx / 200) * 100).toFixed(1) + '%');
    glow.style.setProperty('--gy', ((ly / 240) * 100).toFixed(1) + '%');
    svg.style.transform = `perspective(600px) rotateY(${((lx - 100) / 100) * 9}deg) rotateX(${(-(ly - 120) / 120) * 7}deg)`;
  }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ 2) magazine / flip-book */
const COVER = `
  <div class="pg pg-cover">
    <div class="pic g-dusk"><img data-snap="side" alt=""></div>
    <div class="cv-top"><b>TORQUE</b><small>THE DRIVER'S MAGAZINE &nbsp;·&nbsp; ISSUE 911</small></div>
    <div class="cv-bottom"><em>The 911 issue</em><span>Icons never age.</span></div>
  </div>`;
const PAGES = [
  COVER,
  `<div class="pg pg-photo"><div class="pic g-dark"><img data-snap="front34" alt=""></div>
     <p class="cap"><i>›</i> The silhouette that never changed its mind.</p></div>`,
  `<div class="pg pg-text">
     <span class="tag">THE ICON</span>
     <h3>One idea.<br>Sixty years.</h3>
     <p>Since 1963 the 911 has kept the same recipe: an engine behind the rear axle, a sloping roofline and round headlights. Every generation sharpens the idea without ever breaking it.</p>
     <ul><li><b>Rear-mounted flat-six</b> for traction and sound</li><li><b>Fastback roofline</b> you recognise from a block away</li><li><b>Round headlights</b>, always</li></ul>
     <span class="folio">02</span></div>`,
  `<div class="pg pg-text">
     <span class="tag">BY THE NUMBERS</span>
     <h3>Quick,<br>in every sense.</h3>
     <div class="bar"><label>0 – 100 km/h <b>≈ 4 s</b></label><i style="--w:78%"></i></div>
     <div class="bar"><label>Top speed <b>≈ 290 km/h</b></label><i style="--w:88%"></i></div>
     <div class="bar"><label>Engine <b>3.0 L flat-six</b></label><i style="--w:62%"></i></div>
     <p class="note">Example figures for a modern Carrera. Please check the official data for the exact model.</p>
     <span class="folio">03</span></div>`,
  `<div class="pg pg-photo"><div class="pic g-cool"><img data-snap="side" alt=""></div>
     <p class="cap"><i>›</i> Short overhangs, low roof, wide hips.</p></div>`,
  `<div class="pg pg-text">
     <span class="tag">DESIGN DETAILS</span>
     <h3>Look closer.</h3>
     <ul class="big">
       <li><b>Light bar across the tail</b><span>One clean line that glows at night.</span></li>
       <li><b>Wide rear shoulders</b><span>Muscle you can see from the front.</span></li>
       <li><b>Big wheels, tight arches</b><span>Everything pulled in close to the road.</span></li>
     </ul>
     <span class="folio">05</span></div>`,
  `<div class="pg pg-photo"><div class="pic g-dusk"><img data-snap="rear34" alt=""></div>
     <p class="cap"><i>›</i> Built to be driven, every day.</p></div>`,
  `<div class="pg pg-back"><b>TORQUE</b><p>Thanks for reading.</p><small>Keep scrolling and take the 911 apart.</small></div>`,
];

function initBook(getSnapshots) {
  const openBtn = document.getElementById('bookOpen');
  const mini = document.getElementById('miniMag');
  if (!openBtn || !mini) return;
  mini.innerHTML = COVER;

  const modal = document.createElement('div');
  modal.className = 'book-modal';
  modal.innerHTML = `
    <div class="book-stage"><div class="book" id="book"></div></div>
    <button class="book-close" aria-label="Close the magazine">✕</button>
    <div class="book-nav">
      <button data-dir="-1" aria-label="Previous page">‹</button>
      <span id="bookPageLabel">Cover</span>
      <button data-dir="1" aria-label="Next page">›</button>
    </div>`;
  document.body.appendChild(modal);
  const book = modal.querySelector('#book');
  const label = modal.querySelector('#bookPageLabel');

  const N = PAGES.length / 2;
  const sheets = [];
  for (let i = 0; i < N; i++) {
    const s = document.createElement('div');
    s.className = 'sheet';
    s.innerHTML = `<div class="face front">${PAGES[2 * i]}</div><div class="face back">${PAGES[2 * i + 1]}</div>`;
    s.addEventListener('click', () => {
      stopAuto();
      if (i === flipped) setFlipped(flipped + 1);          // turn the page forwards
      else if (i === flipped - 1) setFlipped(flipped - 1);  // turn it back
    });
    book.appendChild(s);
    sheets.push(s);
  }

  let flipped = 0, autoTimer = 0, snaps = null;
  function fillImages() {
    if (!snaps) return;
    document.querySelectorAll('img[data-snap]').forEach((img) => {
      if (snaps[img.dataset.snap]) img.src = snaps[img.dataset.snap];
    });
  }
  function ensureSnaps() {
    if (snaps) return;
    try { snaps = getSnapshots(); } catch (err) { console.error('Snapshots failed:', err); snaps = {}; }
    fillImages();
  }
  function setFlipped(n) {
    flipped = Math.max(0, Math.min(N, n));
    sheets.forEach((s, i) => {
      const f = i < flipped;
      s.classList.toggle('flipped', f);
      s.style.zIndex = f ? i + 1 : N - i;
    });
    book.dataset.state = flipped === 0 ? 'closed' : flipped === N ? 'end' : 'open';
    label.textContent = flipped === 0 ? 'Cover' : flipped === N ? 'Back cover' : `Pages ${2 * flipped} – ${2 * flipped + 1}`;
  }
  function stopAuto() { clearTimeout(autoTimer); autoTimer = 0; }
  function autoFlip(step) {                                   // the magazine opens and the first pages turn by themselves
    if (step > 2) return;
    autoTimer = setTimeout(() => { setFlipped(step); autoFlip(step + 1); }, step === 1 ? 700 : 2600);
  }
  function openBook() {
    ensureSnaps();
    setFlipped(0);
    modal.classList.add('show');
    document.body.classList.add('no-scroll');
    stopAuto();
    autoFlip(1);
  }
  function closeBook() {
    stopAuto();
    modal.classList.remove('show');
    document.body.classList.remove('no-scroll');
  }
  openBtn.addEventListener('click', openBook);
  modal.querySelector('.book-close').addEventListener('click', closeBook);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.classList.contains('book-stage')) closeBook(); });
  modal.querySelectorAll('.book-nav button').forEach((b) => b.addEventListener('click', () => { stopAuto(); setFlipped(flipped + Number(b.dataset.dir)); }));
  window.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('show')) return;
    if (e.key === 'Escape') closeBook();
    if (e.key === 'ArrowRight') { stopAuto(); setFlipped(flipped + 1); }
    if (e.key === 'ArrowLeft') { stopAuto(); setFlipped(flipped - 1); }
  });
  setFlipped(0);

  // take the pictures of the 3D car shortly before the section comes into view
  new IntersectionObserver(([e]) => { if (e.isIntersecting) { ensureSnaps(); } }, { rootMargin: '600px 0px' })
    .observe(document.getElementById('cards'));
}

/* ------------------------------------------------------------------ 3) take the 911 apart */
function initXray(rig) {
  const media = document.querySelector('.card-xray .card-media');
  const canvas = document.getElementById('xrayCanvas');
  const hint = document.getElementById('xrayHint');
  if (!media || !canvas || !rig) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 4 / 3, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x20242c, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);

  const car = SkeletonUtils.clone(rig.group);
  car.position.set(0, 0, 0); car.rotation.set(0, 0, 0); car.scale.set(1, 1, 1);
  const lights = [];
  car.traverse((o) => { if (o.isLight) lights.push(o); });
  lights.forEach((l) => l.parent && l.parent.remove(l));
  const cache = new Map();
  const parts = [];
  car.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const cm = (m) => {
      if (cache.has(m)) return cache.get(m);
      const c = m.clone(); c.envMap = envTex; c.envMapIntensity = 0.8; cache.set(m, c); return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(cm) : cm(o.material);
    parts.push(o);
  });
  const holder = new THREE.Group();
  holder.add(car);
  scene.add(holder);
  holder.updateMatrixWorld(true);

  // every part flies away from the centre of the car
  const centre = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3());
  const hash = (n) => { const s = Math.sin(n * 91.7 + 3.1) * 43758.5453; return s - Math.floor(s); };
  parts.forEach((mesh, i) => {
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const d = c.sub(centre).multiplyScalar(1.15 + hash(i) * 0.5);
    d.y += (hash(i + 7) - 0.25) * 0.9;
    const q = new THREE.Quaternion();
    mesh.parent.getWorldQuaternion(q).invert();
    const s = new THREE.Vector3();
    mesh.parent.getWorldScale(s);
    d.applyQuaternion(q).divide(s);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.delta = d;
  });
  if (hint) hint.dataset.parts = parts.length + ' parts';

  function resize() {
    const w = media.clientWidth, h = media.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(media);
  resize();

  let hovered = false, ex = 0, exTarget = 0, t = 0, mx = 0, visible = false, last = performance.now();
  media.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
  media.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hovered = false; });
  media.addEventListener('pointermove', (e) => {
    const r = media.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  });
  media.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') hovered = !hovered; });   // touch screens: tap to toggle
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 }).observe(media);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible) return;
    t += dt;
    // without a hover it takes itself apart every few seconds, so you notice it
    const cycle = t % 9;
    exTarget = hovered ? 1 : (cycle > 3.5 && cycle < 6.5 ? 1 : 0);
    ex += (exTarget - ex) * (1 - Math.exp(-3.2 * dt));
    const e = ex * ex * (3 - 2 * ex);
    for (const m of parts) m.position.copy(m.userData.base).addScaledVector(m.userData.delta, e);
    holder.rotation.y = t * 0.35 + mx * 0.5;
    camera.position.set(5.2 + e * 2.2, 1.7 + e * 0.8, 6.0 + e * 3.6);
    camera.lookAt(0, 0.7, 0);
    media.classList.toggle('apart', e > 0.5);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
