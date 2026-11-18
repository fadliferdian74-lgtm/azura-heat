// city.js — procedural Port Azura: island, ocean with a sun-glitter path,
// road grid, six districts of textured buildings, palms, beach, the working
// port, and a foreground/midground/background prop kit (streetlights,
// benches, crates, barriers, awnings, rooftop units, shop signs, distant
// skyline). All static dressing is merged into a handful of draw calls via
// the Bucket system in materials.js; colliders are unchanged circles.
import * as THREE from 'three';
import { ROADS, ROAD_W, CITY_HALF, COLORS, rng, districtAt, nearestRoad } from './config.js';
import {
  Bucket, MAT, facadeTexture, asphaltTexture, sidewalkTexture, sandTexture,
  waterTexture, glitterTexture, containerTexture, woodTexture, awningTexture,
  hazardTexture, signTexture,
} from './materials.js';

export function buildCity(scene) {
  const rand = rng(42);
  const group = new THREE.Group(); scene.add(group);
  const colliders = [];   // {x,z,r} circles for buildings/props
  const anim = { water: null, t: 0 };

  // --- shared materials ------------------------------------------------------
  const facadeMats = [0, 1, 2, 3].map(i => new THREE.MeshLambertMaterial({ map: facadeTexture(1000 + i * 131, i), vertexColors: true }));
  const facadeTints = [0xb09a86, 0x9fb2c4, 0xc4a684, 0xa8b89a, 0xc49a8a, 0x93a7bd, 0xd6c9a8];
  const asphaltMat = new THREE.MeshLambertMaterial({ map: asphaltTexture() });
  const walkTex = sidewalkTexture();
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  const slabMat = new THREE.MeshLambertMaterial({ map: walkTex, color: 0x939e83 });
  const sandMat = new THREE.MeshLambertMaterial({ map: sandTexture() });
  const containerMat = new THREE.MeshLambertMaterial({ map: containerTexture(), vertexColors: true });
  const woodMat = new THREE.MeshLambertMaterial({ map: woodTexture(), vertexColors: true });
  const awningMat = new THREE.MeshLambertMaterial({ map: awningTexture(), vertexColors: true, side: THREE.DoubleSide });
  const hazardMat = new THREE.MeshLambertMaterial({ map: hazardTexture() });
  const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const canopyMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x77688f, fog: false }); // hazy mainland purple

  // --- buckets (one merged mesh each) ----------------------------------------
  const facadeB = facadeMats.map(() => new Bucket());
  const roofB = new Bucket(), unitB = new Bucket(), asphaltB = new Bucket(), walkB = new Bucket();
  const dashB = new Bucket(), trunkB = new Bucket(), leafB = new Bucket(), craneB = new Bucket();
  const containerB = new Bucket(), woodB = new Bucket(), metalB = new Bucket(), lampB = new Bucket();
  const canopyB = new Bucket(), awningB = new Bucket(), hazardB = new Bucket(), hullB = new Bucket();
  const sailB = new Bucket(), skylineB = new Bucket();

  // --- island base: sand disc, city slab, beach ring -------------------------
  const sandGeo = new THREE.CircleGeometry(478, 48);
  { const uv = sandGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 52, uv.getY(i) * 52); }
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.25; group.add(sand);
  const slabGeo = new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2);
  { const uv = slabGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 110, uv.getY(i) * 110); }
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.rotation.x = -Math.PI / 2; slab.position.y = 0.0; group.add(slab);

  // --- animated ocean + sun-glitter path --------------------------------------
  const waterGeo = new THREE.CircleGeometry(1500, 40);
  { const uv = waterGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 110, uv.getY(i) * 110); }
  const water = new THREE.Mesh(waterGeo,
    new THREE.MeshPhongMaterial({ color: COLORS.water, map: waterTexture(), shininess: 120, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.6; group.add(water);
  anim.water = water;
  const glitterGeo = new THREE.PlaneGeometry(95, 400); glitterGeo.rotateX(-Math.PI / 2);
  const glitter = new THREE.Mesh(glitterGeo, new THREE.MeshBasicMaterial({
    color: 0xffc978, alphaMap: glitterTexture(), transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glitter.position.set(-540, -1.05, -225);
  glitter.rotation.y = Math.atan2(-0.82, -0.50);
  group.add(glitter);

  // --- roads + sidewalks + dashes + downtown crosswalks -----------------------
  const len = CITY_HALF * 2;
  for (const r of ROADS) {
    asphaltB.add(new THREE.PlaneGeometry(len, ROAD_W), 0, 0.07, r, { r: [-Math.PI / 2, 0, 0], uv: [len / 14, ROAD_W / 14] });
    asphaltB.add(new THREE.PlaneGeometry(ROAD_W, len), r, 0.07, 0, { r: [-Math.PI / 2, 0, 0], uv: [ROAD_W / 14, len / 14] });
    for (const s of [-1, 1]) {
      walkB.add(new THREE.PlaneGeometry(len, 3), 0, 0.1, r + s * (ROAD_W / 2 + 1.5), { r: [-Math.PI / 2, 0, 0], uv: [len / 5, 0.6] });
      walkB.add(new THREE.PlaneGeometry(3, len), r + s * (ROAD_W / 2 + 1.5), 0.1, 0, { r: [-Math.PI / 2, 0, 0], uv: [0.6, len / 5] });
    }
    for (let d = -CITY_HALF + 14; d < CITY_HALF; d += 28) {
      dashB.box(8, 0.05, 0.7, d, 0.13, r, { c: 0xf5d76e });
      dashB.box(0.7, 0.05, 8, r, 0.13, d, { c: 0xf5d76e });
    }
  }
  for (const ix of [-70, 0, 70]) for (const iz of [-70, 0, 70]) {
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      dashB.box(0.75, 0.05, 3.2, ix + s * (ROAD_W / 2 + 3), 0.12, iz - 8 + k * 4, { c: 0xe8e8e2 });
      dashB.box(3.2, 0.05, 0.75, ix - 8 + k * 4, 0.12, iz + s * (ROAD_W / 2 + 3), { c: 0xe8e8e2 });
    }
  }

  // --- streetlights: pole + arm in metal, warm head in the emissive bucket ----
  // (alternating sides per road, skipped at intersections so corners stay clear)
  for (const r of ROADS) {
    let n = 0;
    for (let d = -308; d <= 308; d += 56, n++) {
      if (ROADS.some(o => Math.abs(d - o) < 13)) continue;
      const s = n % 2 === 0 ? 1 : -1, off = ROAD_W / 2 + 2.4;
      for (const alongX of [true, false]) {
        const x = alongX ? d : r + s * off, z = alongX ? r + s * off : d;
        metalB.add(new THREE.CylinderGeometry(0.09, 0.13, 5.6, 6), x, 2.8, z, { c: 0x2c3138 });
        const ax = alongX ? x : x - s * 0.75, az = alongX ? z - s * 0.75 : z;
        metalB.box(0.12, 0.12, 1.6, alongX ? ax : ax, 5.5, alongX ? az : az, { c: 0x2c3138, r: alongX ? [0, 0, 0] : [0, Math.PI / 2, 0] });
        lampB.box(0.36, 0.14, 0.85, alongX ? x : x - s * 1.45, 5.5, alongX ? z - s * 1.45 : z, { c: 0xffd9a0, r: alongX ? [0, 0, 0] : [0, Math.PI / 2, 0] });
      }
    }
  }

  // --- buildings: one or more per block, height/style by district -------------
  const roofCols = [0x4c4640, 0x5a4a3c, 0x3e444a];
  const unitCols = [0x8b9096, 0x767c84, 0x9aa0a4];
  const awnCols = [0xe74c3c, 0x16a3a3, 0xf2b035, 0x3f7fd1, 0xecf0f1];
  for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
    const cx = (ROADS[i] + ROADS[i + 1]) / 2, cz = (ROADS[j] + ROADS[j + 1]) / 2;
    const dist = districtAt(cx, cz);
    const downtown = dist === 'Downtown';
    const n = downtown ? 2 : 1 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const w = 16 + rand() * 18, d = 16 + rand() * 18;
      let h;
      if (downtown) h = 42 + rand() * 55;                    // towers
      else if (dist === 'Port Azura Docks') h = 10 + rand() * 8;   // warehouses
      else if (dist === 'Palm Hills') h = 7 + rand() * 5;    // villas
      else h = 12 + rand() * 22;
      const x = cx + (rand() - 0.5) * 22, z = cz + (rand() - 0.5) * 22;
      const texIdx = Math.floor(rand() * facadeMats.length);
      const tint = facadeTints[Math.floor(rand() * facadeTints.length)];
      facadeB[texIdx].add(new THREE.BoxGeometry(w, h, d), x, h / 2, z, { c: tint, uv: [Math.max(1, w / 15), Math.max(1, h / 15)] });
      roofB.box(w + 1, 1.2, d + 1, x, h + 0.6, z, { c: roofCols[(i + j + k) % 3] });
      // rooftop dressing: AC units, water tanks, antennas on the towers
      if (rand() < 0.7) {
        unitB.box(2.5 + rand() * 3, 1 + rand() * 0.9, 2.5 + rand() * 2.5,
          x + (rand() - 0.5) * w * 0.4, h + 1.7, z + (rand() - 0.5) * d * 0.4, { c: unitCols[k % 3] });
      }
      if (h > 36) {
        const ax = x + w * 0.32, az = z - d * 0.3, ah = 6 + rand() * 5;
        unitB.add(new THREE.CylinderGeometry(0.07, 0.07, ah, 5), ax, h + 1.2 + ah / 2, az, { c: 0x3a3f46 });
        lampB.add(new THREE.SphereGeometry(0.17, 6, 6), ax, h + 1.4 + ah, az, { c: 0xff4444 });
      }
      // shop awning on the face toward the nearest road (low-rise only)
      if (h < 26 && rand() < 0.5) {
        const nrx = nearestRoad(x), nrz = nearestRoad(z);
        const ac = awnCols[Math.floor(rand() * awnCols.length)];
        if (Math.abs(x - nrx) < Math.abs(z - nrz)) {
          const s = Math.sign(nrx - x) || 1;
          awningB.box(2.3, 0.1, Math.min(d * 0.8, 10), x + s * (w / 2 + 1.05), 3.05, z, { c: ac, r: [0, 0, s * -0.42] });
        } else {
          const s = Math.sign(nrz - z) || 1;
          awningB.box(Math.min(w * 0.8, 10), 0.1, 2.3, x, 3.05, z + s * (d / 2 + 1.05), { c: ac, r: [s * 0.42, 0, 0] });
        }
      }
      colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
    }
  }

  // --- palm trees ---------------------------------------------------------------
  const leafCols = [0x3f9e4d, 0x359544, 0x4cab5a];
  function palm(x, z, s = 1) {
    const tilt = (rand() - 0.5) * 0.16;
    trunkB.add(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), x, 3.5 * s, z, { r: [0, 0, tilt], s: [s, s, s], c: 0x8a6b46 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      leafB.add(new THREE.ConeGeometry(0.5, 4.6, 4), x + Math.cos(a) * 1.7 * s, 7.4 * s, z + Math.sin(a) * 1.7 * s,
        { r: [Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15], s: [s, s, s], c: leafCols[i % 3] });
    }
    colliders.push({ x, z, r: 0.9 });
  }
  for (const r of ROADS) for (let d = -CITY_HALF + 20; d < CITY_HALF; d += 46) {
    if (rand() < 0.7) palm(r + ROAD_W / 2 + 5, d + (rand() - 0.5) * 8, 0.9 + rand() * 0.5);
    if (rand() < 0.5) palm(d + (rand() - 0.5) * 8, r - ROAD_W / 2 - 5, 0.9 + rand() * 0.5);
  }
  for (let i = 0; i < 46; i++) {  // beach palms
    const a = Math.PI * (0.9 + rand() * 0.9), rr = 395 + rand() * 45;
    palm(Math.cos(a) * rr, Math.sin(a) * rr - 60, 1 + rand() * 0.6);
  }

  // --- port cranes + containers ---------------------------------------------------
  const boxCols = [0xc94f4f, 0x4f7dc9, 0x4fc97d, 0xc9b44f, 0x8a4fc9];
  for (const cx of [-120, 0, 120]) {
    craneB.box(3, 34, 3, cx - 10, 17, 285, { c: 0xd86f2e });
    craneB.box(3, 34, 3, cx + 10, 17, 285, { c: 0xd86f2e });
    craneB.box(46, 3, 3, cx, 34, 285, { c: 0xbf5f24 });
    craneB.box(5, 4, 5, cx + 14, 31, 285, { c: 0xe07f36 });
    metalB.box(0.18, 12, 0.18, cx + 14, 25, 285, { c: 0x2c3138 });   // hoist cable
    metalB.box(2.2, 1.2, 2.2, cx + 14, 18.6, 285, { c: 0x3a3f46 });  // hook block
    colliders.push({ x: cx - 10, z: 285, r: 3 }, { x: cx + 10, z: 285, r: 3 });
    for (let i = 0; i < 7; i++) {
      const px = cx - 26 + rand() * 52, pz = 252 + rand() * 22, py = 2.2 + (rand() < 0.3 ? 4.4 : 0);
      containerB.add(new THREE.BoxGeometry(11, 4.4, 4.6), px, py, pz, { c: boxCols[Math.floor(rand() * boxCols.length)] });
      colliders.push({ x: px, z: pz, r: 6 });
    }
  }

  // --- marina boats -----------------------------------------------------------------
  for (let i = 0; i < 10; i++) {
    const bx = 300 + (i % 5) * 14, bz = -160 + Math.floor(i / 5) * 46;
    hullB.box(9, 1.4, 3.4, bx, -0.6, bz, { c: i % 3 === 0 ? 0xdde3e8 : 0xf2f2f2 });
    metalB.add(new THREE.CylinderGeometry(0.12, 0.12, 9, 5), bx, 3.5, bz, { c: 0x888888 });
  }

  // --- beach boardwalk, umbrellas, vendor cart + extra boats -------------------------
  woodB.box(400, 0.3, 7, -60, 0.15, -352, { c: 0xb0824f, uv: [36, 1] });
  for (let px = -250; px < 135; px += 10) woodB.box(0.5, 0.34, 7, px, 0.16, -352, { c: 0x8a6844 });
  const umbCols = [0xe74c3c, 0xf2b035, 0x16a3a3, 0xecf0f1, 0xe84393, 0x53b6ff];
  for (let i = 0; i < 9; i++) {
    const ux = -168 + i * 24 + rand() * 7, uz = -376 - (i % 3) * 15 - rand() * 5;
    metalB.add(new THREE.CylinderGeometry(0.09, 0.09, 2.7, 5), ux, 1.35, uz, { c: 0xd8d8d8 });
    canopyB.add(new THREE.ConeGeometry(2.3, 0.85, 8), ux, 2.85, uz, { c: umbCols[i % umbCols.length] });
    canopyB.box(1.9, 0.07, 0.95, ux + 1.8, 0.06, uz + 1.2, { c: umbCols[(i + 2) % umbCols.length], r: [0, rand() * 0.8, 0] });
  }
  // vendor cart on the boardwalk's landward edge
  woodB.box(2.8, 1.5, 1.7, -36, 1.05, -357.5, { c: 0xf4f1e8, r: [0, 0.25, 0] });
  canopyB.box(3.3, 0.16, 2.2, -36, 2.35, -357.5, { c: 0xff6b81, r: [0, 0.25, 0] });
  for (const wx of [-1, 1]) {
    metalB.add(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 10),
      -36 + wx * 1.05 * Math.cos(0.25), 0.42, -357.5 + 0.9 - wx * 1.05 * Math.sin(0.25), { c: 0x333333, r: [Math.PI / 2, 0, 0] });
  }
  // sailboats anchored off the south shore + a couple off the docks
  for (const [bx, bz, bry] of [[-195, -520, 0.4], [-75, -548, -0.3], [35, -522, 0.9], [-285, -498, 0.1], [125, -545, -0.7], [225, 505, 2.4], [-205, 510, 2.9]]) {
    const c = Math.cos(bry), s = Math.sin(bry);
    hullB.box(3.2, 1.3, 8.6, bx, -0.8, bz, { c: 0xf2f2f2, r: [0, bry, 0] });
    metalB.add(new THREE.CylinderGeometry(0.1, 0.1, 8.6, 5), bx, 3.5, bz, { c: 0x888888 });
    sailB.add(new THREE.ConeGeometry(1.9, 5.6, 3), bx + s * 0.9, 3.3, bz + c * 0.9, { c: 0xffffff, r: [0, bry, 0], s: [1, 1, 0.25] });
  }

  // --- benches + crates + barriers (foreground prop kit) ------------------------------
  function bench(x, z, alongX) {
    if (alongX) {
      woodB.box(2.2, 0.12, 0.55, x, 0.55, z, { c: 0xa97a4e });
      woodB.box(2.2, 0.5, 0.1, x, 0.95, z + 0.26, { c: 0xa97a4e });
      metalB.box(0.12, 0.55, 0.5, x - 0.9, 0.28, z, { c: 0x2c3138 });
      metalB.box(0.12, 0.55, 0.5, x + 0.9, 0.28, z, { c: 0x2c3138 });
    } else {
      woodB.box(0.55, 0.12, 2.2, x, 0.55, z, { c: 0xa97a4e });
      woodB.box(0.1, 0.5, 2.2, x + 0.26, 0.95, z, { c: 0xa97a4e });
      metalB.box(0.5, 0.55, 0.12, x, 0.28, z - 0.9, { c: 0x2c3138 });
      metalB.box(0.5, 0.55, 0.12, x, 0.28, z + 0.9, { c: 0x2c3138 });
    }
  }
  for (let bx = -220; bx <= 100; bx += 45) bench(bx, -347.2, true);
  for (let bz = -56; bz <= 56; bz += 37) { bench(13.9, bz, false); bench(-13.9, bz + 18, false); }
  const crateRand = rng(99);
  for (let i = 0; i < 18; i++) {
    const dockside = i < 11;
    const px = dockside ? -60 + crateRand() * 120 : (crateRand() < 0.5 ? -1 : 1) * (15 + crateRand() * 5);
    const pz = dockside ? 232 + crateRand() * 16 : -60 + crateRand() * 120;
    woodB.box(1.3, 1.3, 1.3, px, 0.65, pz, { c: [0xb0824f, 0x9a7443, 0xc09a63][i % 3], r: [0, crateRand() * 0.7, 0] });
    if (crateRand() < 0.4) woodB.box(1.15, 1.15, 1.15, px, 1.9, pz, { c: 0xa97a4e, r: [0, crateRand() * 0.7, 0] });
  }
  for (const [bx, bz, alongX] of [[11.5, -105, false], [-11.5, -105, false], [11.5, 105, false], [-11.5, 105, false], [-175, 11.5, true], [35, 11.5, true], [-175, -11.5, true], [35, -11.5, true]]) {
    if (alongX) {
      hazardB.box(2.4, 0.7, 0.14, bx, 0.78, bz, {});
      metalB.box(0.12, 0.8, 0.4, bx - 1, 0.4, bz, { c: 0x2c3138 });
      metalB.box(0.12, 0.8, 0.4, bx + 1, 0.4, bz, { c: 0x2c3138 });
    } else {
      hazardB.box(0.14, 0.7, 2.4, bx, 0.78, bz, {});
      metalB.box(0.4, 0.8, 0.12, bx, 0.4, bz - 1, { c: 0x2c3138 });
      metalB.box(0.4, 0.8, 0.12, bx, 0.4, bz + 1, { c: 0x2c3138 });
    }
  }

  // --- distant skyline silhouette ring (background layer) ------------------------------
  const skyRand = rng(7);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + skyRand() * 0.1;
    const ca = Math.cos(a), sa = Math.sin(a);
    // keep the west-northwest corridor open: the beach sunset and the sun
    // disc live there, and a tower in front of the sun reads as a monolith
    if (ca < -0.55 && sa > -0.75 && sa < 0.35) continue;
    const rr = 920 + skyRand() * 360, w = 40 + skyRand() * 50, h = 30 + skyRand() * 55, d = 40 + skyRand() * 50;
    skylineB.box(w, h, d, ca * rr, h / 2 - 4, sa * rr, { r: [0, skyRand() * Math.PI, 0] });
  }

  // --- shop signs: poles + back board merged, lettered face per shop -------------------
  const signPlanes = [];
  function sign(text, sub, bg, x, y, z, rotY) {
    const nx = Math.sin(rotY), nz = Math.cos(rotY), ax = Math.cos(rotY), az = -Math.sin(rotY);
    for (const s of [-1, 1]) {
      metalB.add(new THREE.CylinderGeometry(0.07, 0.07, y - 0.9, 5), x + ax * s * 3.3, (y - 0.9) / 2, z + az * s * 3.3, { c: 0x23262c });
    }
    metalB.box(8.4, 2.2, 0.24, x, y, z, { c: 0x23262c, r: [0, rotY, 0] });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 2),
      new THREE.MeshLambertMaterial({ map: signTexture(text, sub, bg) }));
    plane.position.set(x + nx * 0.16, y, z + nz * 0.16);
    plane.rotation.y = rotY;
    signPlanes.push(plane);
  }
  sign('HOTEL BRISA', 'DOWNTOWN • ROOMS', '#274b63', -13.4, 4.8, 16, Math.PI / 2);
  sign('CAFÉ OLE', 'COFFEE • PASTRIES', '#7a3b2e', 13.4, 4.4, 8, -Math.PI / 2);
  sign('AZURA PAINT & REPAIR', 'FIX • RESPRAY • HEAT GONE', '#31572c', -35, 4.6, 93, Math.PI);
  sign("PRIMO'S MOTORS", 'WE BUY ANY CAR', '#5b2a86', 226, 4.6, 226, -2.36);
  sign('CAFÉ OLE', 'ON THE BOARDWALK', '#7a3b2e', -96, 3.8, -348.5, Math.PI / 2);
  sign('AZURA FREIGHT', 'PORT AZURA DOCKS', '#37474f', 18, 5.4, 236, Math.PI);

  // --- build every bucket into the group -------------------------------------------------
  const built = [
    ...facadeB.map((b, i) => b.build(facadeMats[i])),
    roofB.build(MAT.vc), unitB.build(MAT.vc), asphaltB.build(asphaltMat), walkB.build(walkMat),
    dashB.build(MAT.vcBasic), trunkB.build(MAT.vc), leafB.build(leafMat), craneB.build(MAT.vc),
    containerB.build(containerMat), woodB.build(woodMat), metalB.build(MAT.vc), lampB.build(MAT.vcBasic),
    canopyB.build(canopyMat), awningB.build(awningMat), hazardB.build(hazardMat), hullB.build(MAT.vc),
    sailB.build(canopyMat), skylineB.build(skylineMat),
  ];
  for (const m of built) if (m) group.add(m);
  for (const p of signPlanes) group.add(p);

  function update(dt) {
    anim.t += dt;
    if (anim.water) {
      anim.water.position.y = -1.6 + Math.sin(anim.t * 0.7) * 0.18;
      anim.water.material.color.setHSL(0.55, 0.62, 0.36 + Math.sin(anim.t * 0.4) * 0.03);
    }
  }
  return { group, colliders, update };
}

// Push a point out of every circular collider; returns corrected [x,z].
export function resolveCollisions(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z, rr = c.r + radius, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * rr; z = c.z + (dz / d) * rr;
    }
  }
  return [x, z];
}
