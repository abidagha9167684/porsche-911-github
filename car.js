import * as THREE from 'three';

// A procedural, 911-style placeholder car (no model file needed).
// Car length runs along X: FRONT = +X, REAR = -X. Ground is y = 0.
// Replace it with a real .glb by putting the file in /models (see README.md).

export function buildPlaceholderCar() {
  const group = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xc1121f, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x080b10, metalness: 0.9, roughness: 0.06, clearcoat: 1,
  });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.7, metalness: 0.2 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, metalness: 1, roughness: 0.18 });

  // ---------- body: side profile extruded across the width ----------
  const P = [ // key points of the 911 silhouette
    [-2.2, 0.3], [-2.2, 0.78],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(...P[0]);
  shape.lineTo(...P[1]);
  const c1 = new THREE.CubicBezierCurve(
    new THREE.Vector2(-2.2, 0.78), new THREE.Vector2(-2.1, 1.05),
    new THREE.Vector2(-1.3, 1.36), new THREE.Vector2(-0.35, 1.30));
  const c2 = new THREE.CubicBezierCurve(
    new THREE.Vector2(-0.35, 1.30), new THREE.Vector2(0.15, 1.27),
    new THREE.Vector2(0.5, 1.0), new THREE.Vector2(0.95, 0.86));
  shape.bezierCurveTo(-2.1, 1.05, -1.3, 1.36, -0.35, 1.30);
  shape.bezierCurveTo(0.15, 1.27, 0.5, 1.0, 0.95, 0.86);
  shape.lineTo(1.8, 0.64);
  shape.bezierCurveTo(2.1, 0.58, 2.22, 0.48, 2.22, 0.38);
  shape.lineTo(2.15, 0.3);
  shape.lineTo(-2.2, 0.3);

  const DEPTH = 1.4, BT = 0.22, BS = 0.12;
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelSegments: 8, curveSegments: 40,
  });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  group.add(new THREE.Mesh(bodyGeo, paint));
  const halfW = DEPTH / 2 + BT; // ~0.92

  // ---------- side windows ----------
  const gs = new THREE.Shape();
  gs.moveTo(-1.55, 0.9);
  gs.lineTo(-1.5, 1.03);
  gs.lineTo(-1.15, 1.14);
  gs.lineTo(-0.35, 1.2);
  gs.lineTo(0.1, 1.17);
  gs.lineTo(0.3, 1.07);
  gs.lineTo(0.6, 0.92);
  gs.lineTo(-1.55, 0.9);
  const glassW = (halfW + 0.02) * 2;
  const sideGlass = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: glassW, bevelEnabled: false }), glassMat);
  sideGlass.position.z = -glassW / 2;
  group.add(sideGlass);

  // ---------- windshield + rear window (thin ribbons following the roof curve) ----------
  function ribbon(curve, t0, t1, width, outer, inner) {
    const outerPts = [], innerPts = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const n = new THREE.Vector2(-tan.y, tan.x).normalize(); // outward (upwards) normal
      outerPts.push(new THREE.Vector2(p.x + n.x * outer, p.y + n.y * outer));
      innerPts.push(new THREE.Vector2(p.x + n.x * inner, p.y + n.y * inner));
    }
    const s = new THREE.Shape([...outerPts, ...innerPts.reverse()]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
    geo.translate(0, 0, -width / 2);
    return new THREE.Mesh(geo, glassMat);
  }
  group.add(ribbon(c2, 0.12, 0.93, 1.3, BS + 0.012, BS - 0.03));
  group.add(ribbon(c1, 0.4, 0.93, 1.2, BS + 0.012, BS - 0.03));

  // ---------- ducktail lip ----------
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 1.6), paint);
  lip.position.set(-2.22, 0.9, 0);
  lip.rotation.z = 0.2;
  group.add(lip);

  // ---------- lights ----------
  const headMats = [];
  const spots = [];
  for (const side of [-1, 1]) {
    const m = new THREE.MeshStandardMaterial({
      color: 0xdedede, emissive: 0xfff4d6, emissiveIntensity: 0, metalness: 0.2, roughness: 0.1,
    });
    headMats.push(m);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), m);
    h.position.set(1.95, 0.73, side * 0.62);
    h.scale.set(1.15, 1, 1);
    group.add(h);

    const spot = new THREE.SpotLight(0xfff2d8, 0, 14, 0.5, 0.6, 1);
    spot.position.set(2.0, 0.7, side * 0.62);
    spot.target.position.set(9, 0.05, side * 0.9);
    group.add(spot, spot.target);
    spots.push(spot);
  }

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x400000, emissive: 0xff0a05, emissiveIntensity: 0.15, roughness: 0.3,
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.5), tailMat);
  tail.position.set(-2.33, 0.7, 0);
  group.add(tail);

  // ---------- exhausts ----------
  const exhausts = [];
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.32, 24, 1, true), chromeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-2.3, 0.38, side * 0.5);
    group.add(pipe);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), blackMat);
    inner.rotation.z = Math.PI / 2;
    inner.position.set(-2.34, 0.38, side * 0.5);
    group.add(inner);
    exhausts.push(new THREE.Vector3(-2.5, 0.38, side * 0.5)); // smoke spawn point (car-local)
  }

  // ---------- wheels ----------
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 48).rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.31, 40).rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 32).rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.5, 0.045, 0.34);
  for (const [x, z] of [[1.45, 0.8], [1.45, -0.8], [-1.38, 0.8], [-1.38, -0.8]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.37, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tireGeo, blackMat));
    spin.add(new THREE.Mesh(rimGeo, chromeMat));
    spin.add(new THREE.Mesh(hubGeo, blackMat));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, chromeMat);
      s.rotation.z = (i * Math.PI) / 5;
      spin.add(s);
    }
    w.add(spin);
    group.add(w);
    wheels.push(spin);
  }

  return {
    group, length: 4.7,
    paintMats: [paint], headMats, tailMat, tailMats: [tailMat], spots, exhausts, wheels,
    spin(a) { wheels.forEach((w) => (w.rotation.z -= a)); },
  };
}
