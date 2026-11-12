import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { buildPlaceholderCar } from './car.js';
import { SmokeSystem } from './smoke.js';
import { EngineAudio } from './engine-audio.js';
import { initLights } from './lights.js';
import { initCards } from './cards.js';
import { initFinder } from './finder.js';
import { initDiscover } from './discover.js';

/* =====================================================================
   SETTINGS — change these when you add your own 3D car
   ===================================================================== */
const CONFIG = {
  MODEL_URL: 'models/porsche911.glb', // 1st choice: a .glb here (best for the web)
  FBX_URL: 'Porsche-911/source/FINAL_MODEL_S19/FINAL_MODEL_S19.fbx', // 2nd choice: the downloaded FBX
  MODEL_LENGTH: 4.7,                  // the model is scaled to this length
  MODEL_ROTATION_Y: 0,                // if the car faces backwards use Math.PI (front must point to the RIGHT in the side view)
  // exhaust positions for a loaded model, as fractions of the car (x: -0.5 = rear, y: 0..1 height, z: sideways)
  MODEL_EXHAUST: [[-0.5, 0.27, -0.21], [-0.5, 0.27, 0.21]],
  RACE_SECONDS: 4.5,
};

/* ===================================================================== */
// Arrival intro: the car drives in from the left, brakes, stops in the middle,
// then the camera swings round to the front and you can rotate / start / race.
const INTRO = { dur: 4.2, startX: -20, N: 2.2, camHold: 0.5, camMove: 2.4 };
let introT = -0.7, introDone = false, introSpeed = 0, braking = 0, tireAcc = 0;
// DRIFT button: the car slides round in circles (donuts) with tire smoke, then straightens up and stops
const DRIFT = { R: 2.7, speed: 9.5, beta: 0.95, dur: 6.8, tail: 1.4 };
const drift = { active: false, t: 0, phi: Math.PI / 2, yaw: 0, s: 0, finalSet: false, yawStart: 0, yawFinal: 0 };
const sstep = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

const $ = (id) => document.getElementById(id);
const hero = $('hero');
const canvas = $('scene');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const IS_TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.5 : 2)); // a bit lower on phones, for speed
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const camSide = new THREE.Vector3(0.6, 1.25, 8.6);   // side view while the car arrives
const camFront = new THREE.Vector3(5.8, 1.5, 5.4);   // front 3/4 "showroom" view
// On narrow (portrait) screens the camera stands further back, so the whole car fits
{
  const aspect = hero.clientWidth / Math.max(1, hero.clientHeight);
  const fit = Math.max(1, 0.86 / aspect);
  if (fit > 1) {
    const tgt = new THREE.Vector3(0, 0.7, 0);
    for (const v of [camSide, camFront]) v.sub(tgt).multiplyScalar(fit).add(tgt);
  }
}
camera.position.copy(camSide);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = Math.max(11, camFront.distanceTo(new THREE.Vector3(0, 0.7, 0)) * 1.15);
controls.maxPolarAngle = Math.PI / 2 - 0.04;
controls.enablePan = false;
if (IS_TOUCH) canvas.style.touchAction = 'pan-y'; // phones: swipe up/down scrolls the page, swipe sideways turns the car
controls.enableZoom = false; // plain scrolling over the car scrolls the page; Ctrl + wheel / pinch zooms (below)
canvas.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const off = camera.position.clone().sub(controls.target);
  off.setLength(THREE.MathUtils.clamp(off.length() * (1 + e.deltaY * 0.004), controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(off);
}, { passive: false });
controls.autoRotate = false;   // switched on when the intro has finished
controls.autoRotateSpeed = 0.7;
controls.enabled = false;      // switched on when the intro has finished
let resumeTimer = 0;
controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(resumeTimer); });
controls.addEventListener('end', () => { resumeTimer = setTimeout(() => (controls.autoRotate = true), 5000); });

/* ---------- lights ---------- */
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 7, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff3a22, 1.6);
rim.position.set(-6, 3, -5);
scene.add(rim);
const floorGlow = new THREE.PointLight(0xff2a12, 0, 8, 2);
floorGlow.position.set(0, 0.3, 0);
scene.add(floorGlow);
const exhaustFlash = new THREE.PointLight(0xff7a1a, 0, 3.5, 2);
scene.add(exhaustFlash);

/* ---------- floor + fake contact shadow ---------- */
function radialTexture(stops) {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(16, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({
    color: 0x17171d, roughness: 0.55, metalness: 0.35, transparent: true,
    alphaMap: radialTexture([[0, '#fff'], [0.45, '#bbb'], [1, '#000']]),
  })
);
scene.add(floor);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(7.2, 3.6).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.55, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true, depthWrite: false,
  })
);
shadow.position.y = 0.01;
scene.add(shadow);

/* ---------- car (try the real model first, fall back to the placeholder) ---------- */
let rig = null;
let drive = null;

function useRig(r) {
  rig = r;
  rig.group.position.x = INTRO.startX;
  introT = -0.7;
  scene.add(rig.group);
  rig.group.rotation.order = 'YXZ'; // yaw first, then roll/pitch in the car's own frame
  rig.group.updateMatrixWorld(true);
  const rear = [];
  (rig.wheels || []).forEach((w) => {
    const v = new THREE.Vector3();
    w.getWorldPosition(v);
    rig.group.worldToLocal(v);
    if (v.x < 0) rear.push(v);
  });
  rig.rearWheels = rear.length ? rear : [new THREE.Vector3(-1.3, 0.37, 0.8), new THREE.Vector3(-1.3, 0.37, -0.8)];
  $('loader').classList.add('done');
  try { drive = initLights(); } catch (err) { console.error('Lights section failed to start:', err); }
  try { initCards({ rig: r, getSnapshots: takeSnapshots }); } catch (err) { console.error('Cards section failed to start:', err); }
  try { initFinder({ getRearShots: takeRearShots }); } catch (err) { console.error('Finder section failed to start:', err); }
  try {
    initDiscover({ getSnapshots: takeSnapshots, getTileShots: takeTileShots, setPaint: setPaintFromTile, rev: revFromTile, getRpm: () => audio.rpm });
  } catch (err) { console.error('Discover section failed to start:', err); }
}

function convertMaterials(root) {
  const paintMats = [], headMats = [], tailMats = [];
  const cache = new Map();
  const conv = (m) => {
    if (cache.has(m)) return cache.get(m);
    const name = m.name || '';
    let n;
    if (/1228|paint/i.test(name)) {
      n = new THREE.MeshPhysicalMaterial({ color: 0xc1121f, metalness: 0.6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04 });
      paintMats.push(n);
    } else if (/glass/i.test(name) && !/light/i.test(name)) {
      n = new THREE.MeshPhysicalMaterial({
        color: 0x06080c, metalness: 0.85, roughness: 0.04, transparent: true, opacity: 0.6,
        side: THREE.DoubleSide, envMapIntensity: 1.6,
      });
    } else {
      n = new THREE.MeshStandardMaterial({
        color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
        map: m.map || null, normalMap: m.normalMap || null,
        emissiveMap: m.emissiveMap || null,
        emissive: m.emissiveMap ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
        emissiveIntensity: m.emissiveMap ? 0.6 : 0,
        roughness: 0.55, metalness: 0.15,
      });
      if (/tyre|tire/i.test(name)) { n.roughness = 0.95; n.metalness = 0; }
      if (/rim|brake|exhaust|mirror/i.test(name)) { n.metalness = 0.9; n.roughness = 0.3; }
      if (m.transparent && m.opacity < 1) { n.transparent = true; n.opacity = m.opacity; }
    }
    if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
    if (n.emissiveMap) n.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    n.name = name;
    cache.set(m, n);
    return n;
  };
  // The front and rear lamps share the same material, so give each side its own copy:
  // white-ish for the headlights, red for the tail lights.
  const lamps = new Map();
  const lampVariant = (n, side) => {
    const key = n.uuid + side;
    if (lamps.has(key)) return lamps.get(key);
    const v = n.clone();
    v.name = n.name + '_' + side;
    v.emissiveMap = n.emissiveMap || n.map || null;
    v.emissive = new THREE.Color(side === 'rear' ? 0xff1408 : 0xfff1d0);
    v.emissiveIntensity = 0;
    (side === 'rear' ? tailMats : headMats).push(v);
    lamps.set(key, v);
    return v;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const side = /Light_B|Bumper_B|Trunk/i.test(o.name) ? 'rear'
               : /Light_F|Fender_F|Bumper_F/i.test(o.name) ? 'front' : null;
    const one = (m) => {
      const n = conv(m);
      return side && /light/i.test(n.name) && !n.isMeshPhysicalMaterial ? lampVariant(n, side) : n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { paintMats, headMats, tailMats };
}

function rigFromModel(model) {
  const { paintMats, headMats, tailMats } = convertMaterials(model);
  const wheelMeshes = [];
  model.traverse((o) => {
    if (o.isMesh && /Tyre|Rim|Disc_Scale/i.test(o.name) && !/Caliper|Brake/i.test(o.name)) wheelMeshes.push(o);
  });
  const wrap = new THREE.Group();   // goes into the scene
  const pivot = new THREE.Group();  // orientation, scale and offset
  pivot.add(model);
  wrap.add(pivot);
  const rot = (axis, angle) =>
    pivot.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  const measure = () => {
    wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot);
    return { box, size: box.getSize(new THREE.Vector3()) };
  };

  let { size } = measure();
  console.log('Model raw size (x,y,z):', size.x.toFixed(1), size.y.toFixed(1), size.z.toFixed(1));
  // the car's smallest dimension is its height -> make that axis point up
  if (size.z <= size.x && size.z <= size.y) rot(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  else if (size.x <= size.y && size.x <= size.z) rot(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  ({ size } = measure());
  // the car's length should run along X
  if (size.z > size.x) rot(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  // make sure the FRONT of the car points to +X (lamps / bumpers named _F are the front, _B the back)
  measure();
  const partCenter = (re) => {
    const b = new THREE.Box3();
    model.traverse((o) => { if (o.isMesh && re.test(o.name)) b.expandByObject(o); });
    return b.isEmpty() ? null : b.getCenter(new THREE.Vector3());
  };
  const frontC = partCenter(/Light_F|Fender_F|Bumper_F/i), backC = partCenter(/Light_B|Bumper_B|Fender_B/i);
  if (frontC && backC && frontC.x < backC.x) rot(new THREE.Vector3(0, 1, 0), Math.PI);
  rot(new THREE.Vector3(0, 1, 0), CONFIG.MODEL_ROTATION_Y);

  ({ size } = measure());
  pivot.scale.setScalar(CONFIG.MODEL_LENGTH / size.x);
  let m = measure();
  const c = m.box.getCenter(new THREE.Vector3());
  pivot.position.set(-c.x, -m.box.min.y, -c.z);
  m = measure();
  const sz = m.size;
  console.log('Model fitted size (m):', sz.x.toFixed(2), sz.y.toFixed(2), sz.z.toFixed(2));

  // headlight beams (assumes the front points to +X)
  const spots = [];
  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff2d8, 0, 14, 0.5, 0.6, 1);
    spot.position.set(sz.x * 0.4, sz.y * 0.5, side * sz.z * 0.3);
    spot.target.position.set(9, 0.05, side * 0.9);
    wrap.add(spot, spot.target);
    spots.push(spot);
  }

  const exhausts = CONFIG.MODEL_EXHAUST.map(([fx, fy, fz]) =>
    new THREE.Vector3(fx * sz.x - 0.2, fy * sz.y, fz * sz.z));
  return {
    group: wrap, length: sz.x, paintMats, headMats, tailMat: null, tailMats, spots, exhausts, wheels: wheelMeshes,
    spin(a) { wheelMeshes.forEach((w) => (w.rotation.x += a)); },
  };
}

// Pictures of the 3D car (used in the magazine). Rendered once with the hero renderer, then cached.
let snapCache = null;
function takeSnapshots() {
  if (snapCache) return snapCache;
  if (!rig) return {};
  const W = 960, H = 640;
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevPR = renderer.getPixelRatio();
  const prevPos = rig.group.position.clone(), prevRot = rig.group.rotation.clone();
  const prevVis = [floor.visible, smoke.points.visible];
  rig.group.position.set(0, 0, 0);
  rig.group.rotation.set(0, 0, 0);
  rig.group.updateMatrixWorld(true);
  floor.visible = false;
  smoke.points.visible = false;
  shadow.position.set(0, 0.01, 0);
  shadow.rotation.y = 0;
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const shots = [
    ['front34', [5.4, 1.35, 5.2], [0, 0.62, 0]],
    ['side', [0.4, 0.95, 9.6], [0, 0.62, 0]],
    ['rear34', [-5.4, 1.35, 5.0], [0, 0.62, 0]],
    ['detail', [3.6, 0.75, 2.6], [1.5, 0.5, 0.4]],
  ];
  const out = {};
  for (const [name, p, l] of shots) {
    cam.position.set(...p);
    cam.lookAt(...l);
    renderer.render(scene, cam);
    out[name] = renderer.domElement.toDataURL('image/png');
  }
  floor.visible = prevVis[0];
  smoke.points.visible = prevVis[1];
  rig.group.position.copy(prevPos);
  rig.group.rotation.copy(prevRot);
  renderer.setPixelRatio(prevPR);
  renderer.setSize(prevSize.x, prevSize.y, false);
  snapCache = out;
  return out;
}

// Rear views of the car in white, for section 4: tail lights off, tail lights ON (pure red) and a red glow-only layer.
let rearCache = null;
function takeRearShots() {
  if (rearCache) return rearCache;
  if (!rig) return {};
  const W = 1100, H = 640;
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevPR = renderer.getPixelRatio();
  const prevPos = rig.group.position.clone(), prevRot = rig.group.rotation.clone();
  const prevVis = [floor.visible, smoke.points.visible, shadow.visible];
  const prevLights = [rim.intensity, floorGlow.intensity, exhaustFlash.intensity];
  const prevPaint = rig.paintMats.map((m) => m.color.clone());

  // which meshes are the rear lamps: parts named ...Light_B... that use a tail-light material
  const tailSet = new Set(rig.tailMats || []);
  const usesTail = (o) => (Array.isArray(o.material) ? o.material : [o.material]).some((m) => tailSet.has(m));
  const meshes = [];
  rig.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  let lamps = meshes.filter((o) => /Light_B/i.test(o.name) && usesTail(o));
  if (!lamps.length) lamps = meshes.filter(usesTail);
  const lampSet = new Set(lamps);
  const prevMats = meshes.map((o) => o.material);
  const red = new THREE.MeshBasicMaterial({ color: 0xff1010, toneMapped: false });          // pure, unlit red
  const occluder = new THREE.MeshBasicMaterial({ colorWrite: false });                      // hides what is behind, draws nothing

  rig.group.position.set(0, 0, 0);
  rig.group.rotation.set(0, 0, 0);
  rig.group.updateMatrixWorld(true);
  floor.visible = false;
  smoke.points.visible = false;
  shadow.visible = false;                         // no ground shadow in these pictures
  rim.intensity = 0; floorGlow.intensity = 0; exhaustFlash.intensity = 0;
  rig.paintMats.forEach((m) => m.color.set(0xf1f1f1));
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  cam.position.set(-6.0, 1.45, 4.7);
  cam.lookAt(0, 0.68, 0);

  const out = {};
  // 1) lights off (the normal car)
  renderer.render(scene, cam);
  out.off = renderer.domElement.toDataURL('image/png');

  // 2) lights ON: the lamp parts are pure red
  lamps.forEach((o) => (o.material = red));
  renderer.render(scene, cam);
  out.on = renderer.domElement.toDataURL('image/png');

  // 3) glow layer: only the red lamps are drawn (the rest of the car just hides what is behind it), transparent elsewhere
  meshes.forEach((o) => { if (!lampSet.has(o)) o.material = occluder; });
  renderer.render(scene, cam);
  out.glow = renderer.domElement.toDataURL('image/png');

  // put everything back
  meshes.forEach((o, i) => (o.material = prevMats[i]));
  rig.paintMats.forEach((m, i) => m.color.copy(prevPaint[i]));
  [rim.intensity, floorGlow.intensity, exhaustFlash.intensity] = prevLights;
  floor.visible = prevVis[0];
  smoke.points.visible = prevVis[1];
  shadow.visible = prevVis[2];
  rig.group.position.copy(prevPos);
  rig.group.rotation.copy(prevRot);
  renderer.setPixelRatio(prevPR);
  renderer.setSize(prevSize.x, prevSize.y, false);
  rearCache = out;
  return out;
}

// ---- helpers for section 5 (discover.js) ----
let tileStartedEngine = false;
function revFromTile() {
  if (!rig) return false;
  if (audio.state === 'off') { tileStartedEngine = true; pendingRace = true; audio.start(); return true; }
  if (audio.state === 'running' && !audio.racing) { doRace(); return true; }
  return false;
}
function setPaintFromTile(hex) {
  if (!rig) return;
  rig.paintMats.forEach((m) => m.color.set(hex));
  if (drive) drive.setPaint(hex);
  [...$('colors').children].forEach((c) => c.classList.remove('active'));
}
// Pictures for the tiles: the car in a fixed red (the paint mixer shifts its hue) and one wheel seen straight on.
let tileCache = null;
function takeTileShots() {
  if (tileCache) return tileCache;
  if (!rig) return {};
  const out = {};
  const prevSize = renderer.getSize(new THREE.Vector2());
  const prevPR = renderer.getPixelRatio();
  const prevPos = rig.group.position.clone(), prevRot = rig.group.rotation.clone();
  const prevVis = [floor.visible, smoke.points.visible, shadow.visible];
  const prevPaint = rig.paintMats.map((m) => m.color.clone());
  const meshes = [];
  rig.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const prevMeshVis = meshes.map((o) => o.visible);
  try {
    rig.group.position.set(0, 0, 0);
    rig.group.rotation.set(0, 0, 0);
    rig.group.updateMatrixWorld(true);
    floor.visible = false;
    smoke.points.visible = false;
    shadow.visible = false;
    renderer.setPixelRatio(1);

    // 1) the car in the base red
    rig.paintMats.forEach((m) => m.color.set(0xc1121f));
    renderer.setSize(960, 640, false);
    const cam = new THREE.PerspectiveCamera(30, 960 / 640, 0.1, 100);
    cam.position.set(5.4, 1.35, 5.2);
    cam.lookAt(0, 0.62, 0);
    renderer.render(scene, cam);
    out.paint = renderer.domElement.toDataURL('image/png');

    // 2) one wheel, straight on (everything else hidden)
    const wheelObjs = rig.wheels || [];
    if (wheelObjs.length) {
      const all = new THREE.Box3();
      wheelObjs.forEach((w) => all.expandByObject(w));
      const d = all.max.y - all.min.y;
      if (d > 0.3 && d < 1.5) {
        meshes.forEach((o) => (o.visible = false));
        wheelObjs.forEach((w) => {
          const c = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
          if (c.z < -0.2) return;                       // wheels on the far side stay hidden
          w.traverse((o) => { if (o.isMesh) o.visible = true; });
        });
        const hh = d * 0.53, cx = all.max.x - d / 2, cy = all.min.y + d / 2;
        const oc = new THREE.OrthographicCamera(-hh, hh, hh, -hh, 0.1, 50);
        oc.position.set(cx, cy, all.max.z + 6);
        oc.lookAt(cx, cy, 0);
        renderer.setSize(512, 512, false);
        renderer.render(scene, oc);
        out.wheel = renderer.domElement.toDataURL('image/png');
      }
    }
  } finally {
    meshes.forEach((o, i) => (o.visible = prevMeshVis[i]));
    rig.paintMats.forEach((m, i) => m.color.copy(prevPaint[i]));
    floor.visible = prevVis[0];
    smoke.points.visible = prevVis[1];
    shadow.visible = prevVis[2];
    rig.group.position.copy(prevPos);
    rig.group.rotation.copy(prevRot);
    renderer.setPixelRatio(prevPR);
    renderer.setSize(prevSize.x, prevSize.y, false);
  }
  tileCache = out;
  return out;
}

function setLoadingText(t) {
  const el = document.querySelector('#loader span');
  if (el) el.textContent = t;
}

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);
const fbxLoader = new FBXLoader();

function loadCar() {
  const progress = (e) => { if (e.total) setLoadingText(Math.round((e.loaded / e.total) * 100) + '%'); };
  const loadFBX = () => fbxLoader.load(
    CONFIG.FBX_URL,
    (obj) => {
      console.log('Loaded FBX:', CONFIG.FBX_URL);
      try { useRig(rigFromModel(obj)); }
      catch (err) { console.error(err); useRig(buildPlaceholderCar()); }
    },
    progress,
    (err) => { console.warn('FBX failed, using placeholder car.', err); useRig(buildPlaceholderCar()); }
  );
  gltfLoader.load(
    CONFIG.MODEL_URL,
    (gltf) => { console.log('Loaded GLB:', CONFIG.MODEL_URL); useRig(rigFromModel(gltf.scene)); },
    progress,
    () => loadFBX()
  );
}
loadCar();

/* ---------- smoke + audio ---------- */
const smoke = new SmokeSystem(scene, renderer, camera, 1800);
const audio = new EngineAudio();
const BACK = new THREE.Vector3(-1, 0, 0);
let flash = 0;

function exhaustWorld(i) {
  return rig.group.localToWorld(rig.exhausts[i].clone());
}
function burst(n, o) {
  rig.group.updateMatrixWorld(true);
  for (let i = 0; i < rig.exhausts.length; i++) smoke.emit(exhaustWorld(i), BACK, n, o);
}

let pendingRace = false, pendingDrift = false;
audio.onIgnite = () => {
  burst(26, { speed: 2.4, spread: 0.5, size0: 0.18, size1: 1.7, alpha: 0.5, life: 3, shade: 0.45 });
  flash = 0.8;
  if (pendingRace) { pendingRace = false; doRace(); }
  if (pendingDrift) { pendingDrift = false; startDrift(); }
};
audio.onPop = (v) => {
  if (!rig) return;
  burst(Math.round(4 + v * 8), { speed: 3.2, spread: 0.6, size0: 0.15, size1: 1.2, alpha: 0.5, life: 2.4, shade: 0.55 });
  flash = Math.max(flash, 0.5 + v * 0.5);
};
audio.onRaceEnd = () => {
  // if the rev tile (section 5) started the engine, switch it off again after the rev
  if (!tileStartedEngine) return;
  tileStartedEngine = false;
  setTimeout(() => { if (audio.state === 'running' && !audio.racing) audio.stop(); }, 1800);
};

/* ---------- UI ---------- */
const startBtn = $('startBtn');
const raceBtn = $('raceBtn');
const rpmFill = $('rpmFill');
const rpmValue = $('rpmValue');

const driftBtn = $('driftBtn');
function doRace() { audio.race(CONFIG.RACE_SECONDS); }
function startDrift() {
  if (drift.active) return;
  Object.assign(drift, { active: true, t: 0, phi: Math.PI / 2, yaw: 0, s: 0, finalSet: false });
  audio.race(DRIFT.dur); // engine revs while drifting
}

startBtn.addEventListener('click', () => {
  if (!rig || !introDone || drift.active) return;
  if (audio.state === 'off') audio.start();
  else if (audio.state === 'running') audio.stop();
});
raceBtn.addEventListener('click', () => {
  if (!rig || !introDone) return;
  if (audio.state === 'off') { pendingRace = true; audio.start(); }
  else if (audio.state === 'running') doRace();
});
driftBtn.addEventListener('click', () => {
  if (!rig || !introDone || drift.active) return;
  if (audio.state === 'off') { pendingDrift = true; audio.start(); }
  else if (audio.state === 'running') startDrift();
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 's' || e.key === 'S') startBtn.click();
  if (e.key === 'r' || e.key === 'R') raceBtn.click();
  if (e.key === 'd' || e.key === 'D') driftBtn.click();
});

$('colors').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !rig) return;
  [...$('colors').children].forEach((c) => c.classList.toggle('active', c === b));
  rig.paintMats.forEach((m) => m.color.set(b.dataset.color));
  if (drive) drive.setPaint(b.dataset.color);
});

function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
// footer: its red light bar switches on when it scrolls into view
const footerEl = $('footer');
if (footerEl) new IntersectionObserver(([e]) => footerEl.classList.toggle('in', e.isIntersecting), { threshold: 0.25 }).observe(footerEl);
let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 }).observe(hero);

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
let intensity = 0, wheelSpeed = 0, lightLevel = 0, emitAcc = 0, fov = 42;
const lerp = THREE.MathUtils.lerp;

function showError(err) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:12px;bottom:40px;z-index:99;max-width:70vw;padding:8px 12px;background:#300;color:#fbb;font:12px/1.4 monospace;border:1px solid #a33;white-space:pre-wrap';
  d.textContent = 'Frame error: ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : err);
  document.body.appendChild(d);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!heroVisible) { if (rig) audio.update(dt); return; } // hero is scrolled away: skip all the work
  controls.update();

  if (rig) try {
    audio.update(dt);

    // keep the exhaust smoke pointing out of the back of the (possibly turning) car
    BACK.set(-1, 0, 0).applyQuaternion(rig.group.quaternion);

    // --- car pose: arrival intro (drift in from the left) / DRIFT button / parked ---
    introT += dt;
    let carX = 0, carZ = 0, yaw = 0, roll = 0, tilt = 0, slip = 0;
    const vdir = new THREE.Vector3(1, 0, 0); // direction the car is travelling (for the tire smoke)
    if (!introDone) {
      const p = THREE.MathUtils.clamp(introT / INTRO.dur, 0, 1);
      const N = INTRO.N;
      carX = lerp(INTRO.startX, 0, 1 - Math.pow(1 - p, N));
      const speed = introT > 0 && p < 1 ? (N * Math.pow(1 - p, N - 1) * -INTRO.startX) / INTRO.dur : 0;
      introSpeed = speed;
      // flick the tail out, hold the slide, catch it, roll to a stop
      const flick = sstep(p, 0.16, 0.38), rec = sstep(p, 0.6, 0.9);
      yaw = -0.85 * flick * (1 - rec) + 0.12 * Math.sin(THREE.MathUtils.clamp((p - 0.82) / 0.18, 0, 1) * Math.PI);
      slip = flick * (1 - sstep(p, 0.7, 0.96)) * THREE.MathUtils.clamp(speed / 3, 0.25, 1);
      roll = 0.05 * flick * (1 - rec);
      tilt = -0.02 * Math.sin(THREE.MathUtils.clamp((p - 0.55) / 0.45, 0, 1) * Math.PI);
      const ts = introT - INTRO.dur;
      if (ts > 0) tilt -= 0.012 * Math.exp(-5 * ts) * Math.sin(10 * ts);
      const c = THREE.MathUtils.clamp((introT - INTRO.dur - INTRO.camHold) / INTRO.camMove, 0, 1);
      const ease = c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
      camera.position.lerpVectors(camSide, camFront, ease);
      if (c >= 1) { introDone = true; controls.enabled = true; controls.autoRotate = true; hero.classList.add('ready'); }
    } else if (drift.active) {
      drift.t += dt;
      const T = drift.t;
      const out = 1 - sstep(T, DRIFT.dur - DRIFT.tail, DRIFT.dur);
      const sp = sstep(T, 0, 1.1) * out;
      drift.s = sp;
      drift.phi -= (DRIFT.speed / DRIFT.R) * sp * dt;
      const rr = DRIFT.R * sstep(T, 0, 1.0) * out;
      carX = rr * Math.cos(drift.phi);
      carZ = rr * Math.sin(drift.phi);
      if (T > DRIFT.dur - DRIFT.tail) {            // straighten up and stop facing forward
        if (!drift.finalSet) {
          drift.finalSet = true;
          drift.yawStart = drift.yaw;
          drift.yawFinal = Math.PI * 2 * Math.round(drift.yaw / (Math.PI * 2));
        }
        drift.yaw = lerp(drift.yawStart, drift.yawFinal, sstep(T, DRIFT.dur - DRIFT.tail, DRIFT.dur - 0.1));
      } else {                                     // nose points into the circle = sideways slide
        const beta = DRIFT.beta * sstep(T, 0.2, 1.2);
        drift.yaw += (Math.PI / 2 - drift.phi + beta - drift.yaw) * (1 - Math.exp(-8 * dt));
      }
      yaw = drift.yaw;
      roll = 0.06 * sp;
      slip = sp * sstep(T, 0, 0.8);
      vdir.set(Math.sin(drift.phi), 0, -Math.cos(drift.phi));
      if (T >= DRIFT.dur) { drift.active = false; drift.s = 0; drift.yaw = 0; yaw = 0; carX = carZ = 0; roll = 0; slip = 0; }
    }
    shadow.position.set(carX, 0.01, carZ);
    shadow.rotation.y = yaw;
    floorGlow.position.set(carX, 0.3, carZ);
    if (audio.setScreech) audio.setScreech(drift.active ? slip : 0);
    const st = audio.state;
    const running = st === 'running';
    const racing = audio.racing;
    const rn = Math.min(1, audio.rpm / audio.maxRpm);

    // --- put the car in place first, so it is always visible even if something later fails ---
    let amp = 0;
    if (st === 'cranking') amp = 0.003;
    else if (running || st === 'stopping') amp = 0.0012 + 0.003 * rn + (racing ? 0.006 : 0);
    rig.group.position.set(carX + (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp, carZ);
    rig.group.rotation.set(roll, yaw, tilt + (Math.random() - 0.5) * amp * 0.6);

    // --- smoke ---
    intensity += ((racing ? 1 : audio.decel > 0 ? 0.3 : 0) - intensity) * (1 - Math.exp(-4 * dt));
    let rate = 0;
    if (running) rate = lerp(20, 170, intensity) + rn * 50;
    else if (st === 'cranking') rate = 9;
    else if (st === 'stopping') rate = 6;
    emitAcc += rate * dt;
    rig.group.updateMatrixWorld();
    const opts = {
      speed: lerp(0.6, 3.4, intensity) + rn * 1.2,
      spread: 0.4,
      size0: lerp(0.1, 0.18, intensity),
      size1: lerp(0.8, 1.9, intensity),
      alpha: lerp(0.2, 0.5, intensity),
      life: lerp(2.0, 3.2, intensity),
      shade: lerp(0.05, 0.4, intensity),
    };
    while (emitAcc >= 1) {
      emitAcc -= 1;
      smoke.emit(exhaustWorld(Math.floor(Math.random() * rig.exhausts.length)), BACK, 1, opts);
    }
    // tire smoke from the rear wheels while sliding
    tireAcc += slip * 260 * dt;
    const tireDir = vdir.clone().multiplyScalar(-0.35);
    const tireOpts = { speed: 0.9, spread: 1.1, size0: 0.28, size1: 2.0, alpha: 0.32, life: 2.1, shade: 0.0 };
    while (tireAcc >= 1) {
      tireAcc -= 1;
      const o = rig.group.localToWorld(rig.rearWheels[Math.floor(Math.random() * rig.rearWheels.length)].clone());
      o.y = 0.08;
      smoke.emit(o, tireDir, 1, tireOpts);
    }
    smoke.update(dt);

    // --- lights ---
    const lampsOn = running || (!introDone && introT < INTRO.dur + 0.8);   // headlights on while arriving
    lightLevel += ((lampsOn ? 1 : 0) - lightLevel) * (1 - Math.exp(-6 * dt));
    const brakeOn = !introDone && introT > INTRO.dur * 0.25 && introT < INTRO.dur + 0.7;
    braking += ((brakeOn ? 1 : 0) - braking) * (1 - Math.exp(-9 * dt));
    rig.headMats.forEach((m) => (m.emissiveIntensity = lightLevel * 3));
    rig.spots.forEach((s) => (s.intensity = lightLevel * 45));
    const tailI = 0.04 + lightLevel * 0.8 + braking * 1.6 + (racing ? 1.4 : 0);
    (rig.tailMats || []).forEach((m) => (m.emissiveIntensity = tailI));
    floorGlow.intensity = lightLevel * (racing ? 14 : 3);
    flash = Math.max(0, flash - dt * 4);
    const ex = exhaustWorld(0).add(exhaustWorld(rig.exhausts.length - 1)).multiplyScalar(0.5);
    exhaustFlash.position.copy(ex).add(new THREE.Vector3(-0.3, 0, 0));
    exhaustFlash.intensity = flash * 10;

    // --- wheels + camera punch ---

    const wheelTarget = !introDone ? Math.max(introSpeed / 0.36, slip * 30) : drift.active ? 45 * drift.s : racing ? 38 : 0;
    if (!introDone) wheelSpeed = wheelTarget;
    else wheelSpeed += (wheelTarget - wheelSpeed) * (1 - Math.exp(-2.5 * dt));
    rig.spin(wheelSpeed * dt);

    fov += ((racing ? 48 : 42) - fov) * (1 - Math.exp(-3 * dt));
    camera.fov = fov;
    camera.updateProjectionMatrix();

    // --- UI state ---
    hero.classList.toggle('on', running || st === 'cranking');
    hero.classList.toggle('racing', racing);
    hero.classList.toggle('shake', racing);
    raceBtn.classList.toggle('active', racing && !drift.active);
    driftBtn.classList.toggle('active', drift.active);
    startBtn.classList.toggle('running', running);
    startBtn.textContent = st === 'off' ? 'START ENGINE' : st === 'cranking' ? 'STARTING…' : 'STOP ENGINE';
    const r = Math.round(audio.rpm / 10) * 10;
    rpmValue.textContent = r;
    rpmFill.style.width = Math.min(100, (audio.rpm / audio.maxRpm) * 100) + '%';
  } catch (err) {
    if (!loop.failed) { loop.failed = true; console.error('Frame error:', err); showError(err); }
  }

  if (heroVisible) renderer.render(scene, camera);
}
loop();

// ---- hooks for the video tour (demo.js) ----
window.__site = {
  isReady: () => introDone,
  // turns the camera round the car by an angle (radians), like dragging with the mouse
  orbitBy(rad) {
    const off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
    camera.position.copy(controls.target).add(off);
  },
  // plays the arrival again: the car drifts in from the left and the camera swings to the front
  replayIntro() {
    if (!rig) return;
    drift.active = false;
    introT = -0.4;
    introDone = false;
    controls.enabled = false;
    controls.autoRotate = false;
    hero.classList.remove('ready');
    camera.position.copy(camSide);
    controls.target.set(0, 0.7, 0);
  },
};

// ---- phones and tablets: menu button, and touch wording for the hints ----
const navEl = document.querySelector('.nav'), navToggle = $('navToggle');
if (navEl && navToggle) {
  const setOpen = (o) => { navEl.classList.toggle('open', o); navToggle.setAttribute('aria-expanded', String(o)); };
  navToggle.addEventListener('click', () => setOpen(!navEl.classList.contains('open')));
  navEl.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
}
if (IS_TOUCH) {
  document.querySelectorAll('.dhint, .xray-hint, .finder-hint, .tap-hint').forEach((el) => {
    el.textContent = el.textContent
      .replace('Move to mix · click to paint', 'Slide to mix · tap to paint')
      .replace('Move your light', 'Slide your light')
      .replace(/^Hover/, 'Tap').replace(/^Click/, 'Tap');
  });
  document.querySelectorAll('.card-cap span').forEach((el) => {
    el.textContent = el.textContent.replace('Hover and let them spin', 'Tap and let them spin');
  });
  const heroHint = document.querySelector('.hero .hint');
  if (heroHint) heroHint.textContent = 'Swipe sideways to rotate · Scroll down ↓';
}
