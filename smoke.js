import * as THREE from 'three';

// Soft, blotchy cloud texture drawn on a canvas (no image file needed)
function makePuffTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 26;
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r;
    const rad = 22 + Math.random() * 20;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }
  // fade the edges so the sprite never shows a square border
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.7, 'rgba(0,0,0,0.8)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m;
  g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  attribute float aShade;
  uniform float uScale;
  varying float vAlpha;
  varying float vRot;
  varying float vShade;
  void main() {
    vAlpha = aAlpha;
    vRot = aRot;
    vShade = aShade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying float vAlpha;
  varying float vRot;
  varying float vShade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot);
    float co = cos(vRot);
    c = mat2(co, -s, s, co) * c + 0.5;
    float a = texture2D(uMap, c).a * vAlpha * 1.7;
    if (a < 0.004) discard;
    vec3 col = mix(vec3(0.88), vec3(0.30), vShade);
    gl_FragColor = vec4(col, min(a, 1.0));
  }
`;

export class SmokeSystem {
  constructor(scene, renderer, camera, max = 900) {
    this.N = max;
    this.renderer = renderer;
    this.camera = camera;
    this.next = 0;

    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max); // 0 = inactive
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.rotSpeed = new Float32Array(max);
    this.drag = new Float32Array(max);

    this.aSize = new Float32Array(max);
    this.aAlpha = new Float32Array(max);
    this.aRot = new Float32Array(max);
    this.aShade = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', dyn(this.pos, 3));
    geo.setAttribute('aSize', dyn(this.aSize, 1));
    geo.setAttribute('aAlpha', dyn(this.aAlpha, 1));
    geo.setAttribute('aRot', dyn(this.aRot, 1));
    geo.setAttribute('aShade', dyn(this.aShade, 1));
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: makePuffTexture() }, uScale: { value: 1000 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  /**
   * Spawn `n` particles at `origin`, drifting along `dir` (world space).
   * o: { speed, spread, size0, size1, alpha, life, shade }
   */
  emit(origin, dir, n, o) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (i + 1) % this.N;
      const sp = o.speed * (0.7 + Math.random() * 0.6);
      const spread = (o.spread ?? 0.4) * o.speed;
      this.pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.04;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.04;
      this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.04;
      this.vel[i * 3] = dir.x * sp + (Math.random() - 0.5) * spread;
      this.vel[i * 3 + 1] = dir.y * sp + (Math.random() - 0.5) * spread + 0.15 + Math.random() * 0.3;
      this.vel[i * 3 + 2] = dir.z * sp + (Math.random() - 0.5) * spread;
      this.age[i] = 0;
      this.life[i] = o.life * (0.75 + Math.random() * 0.5);
      this.size0[i] = o.size0 * (0.8 + Math.random() * 0.4);
      this.size1[i] = o.size1 * (0.7 + Math.random() * 0.6);
      this.alpha0[i] = o.alpha * (0.7 + Math.random() * 0.5);
      this.aRot[i] = Math.random() * Math.PI * 2;
      this.rotSpeed[i] = (Math.random() - 0.5) * 0.8;
      this.aShade[i] = Math.min(1, Math.max(0, o.shade + (Math.random() - 0.5) * 0.15));
      this.drag[i] = 0.9 + Math.random() * 0.5;
    }
  }

  update(dt) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const h = this.renderer.domElement.height;
    this.material.uniforms.uScale.value = h / (2 * Math.tan(fov / 2));

    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.aAlpha[i] = 0; this.aSize[i] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.life[i] = 0; this.aAlpha[i] = 0; this.aSize[i] = 0; continue; }

      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp + 0.35 * dt; // warm air rises
      this.vel[i * 3 + 2] *= damp;

      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;

      this.aRot[i] += this.rotSpeed[i] * dt;
      this.aSize[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * Math.sqrt(t);
      this.aAlpha[i] = this.alpha0[i] * Math.pow(1 - t, 1.5) * Math.min(1, t * 10);
    }

    const g = this.geo.attributes;
    g.position.needsUpdate = true;
    g.aSize.needsUpdate = true;
    g.aAlpha.needsUpdate = true;
    g.aRot.needsUpdate = true;
    g.aShade.needsUpdate = true;
  }
}
