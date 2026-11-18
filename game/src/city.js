// AZURA HEAT — the procedural island city of Port Azura.
// Builds the whole place from the seeded RNG: an island slab with a sand rim,
// a seven-by-seven road grid, six districts of lit buildings, palm trees,
// street lights, the marina docks, port cranes and an animated ocean.
// Exports the building colliders every other system collides against.
import * as THREE from 'three';
import { ISLAND, ROADS, ROAD_W, createRandom, districtAt, CITY_SEED, clamp } from './config.js';

const rand = createRandom(CITY_SEED);
const pick = arr => arr[Math.floor(rand() * arr.length)];

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 10) for (let x = 5; x < 58; x += 9) {
    const lit = rand() > 0.45;
    g.fillStyle = lit ? (rand() > 0.25 ? '#ffd98a' : '#aee6ff') : '#171a21';
    g.fillRect(x, y, 6, 7);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createCity(scene) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group(); scene.add(group);
  const winTex = windowTexture();

  // Golden-hour sky, fog and lights.
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xf7a56b, 180, 720);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-260, 190, 140); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffc98f, 0x3a4a6b, 0.95));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }));
  sunBall.position.set(-560, 120, 300); scene.add(sunBall);

  // Island slab, sand rim and grass interior.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(ISLAND * 2 + 90, 4, ISLAND * 2 + 90),
    new THREE.MeshLambertMaterial({ color: 0xe8cf9e }));
  slab.position.y = -2.05; group.add(slab);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(ISLAND * 2, ISLAND * 2),
    new THREE.MeshLambertMaterial({ color: 0x77a860 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = 0.01; group.add(grass);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(ISLAND * 2 + 88, 60),
    new THREE.MeshLambertMaterial({ color: 0xf2ddab }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, ISLAND + 14); group.add(beach);

  // Ocean: a low-segment plane whose vertices breathe in update().
  const oceanGeo = new THREE.PlaneGeometry(2400, 2400, 40, 40);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshPhongMaterial({
    color: 0x1d6f8e, shininess: 120, specular: 0xffca7a, transparent: true, opacity: 0.94 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -1.1; group.add(ocean);
  const oceanBase = oceanGeo.attributes.position.array.slice();

  // Roads: dark strips along every grid line, sidewalks as lighter frames.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x54565e });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b0a0 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of ROADS) {
    for (const horiz of [true, false]) {
      const len = ISLAND * 2;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : ROAD_W, horiz ? ROAD_W : len), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(horiz ? 0 : r, 0.05, horiz ? r : 0); group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : ROAD_W + 5, horiz ? ROAD_W + 5 : len), walkMat);
      walk.rotation.x = -Math.PI / 2; walk.position.set(horiz ? 0 : r, 0.03, horiz ? r : 0); group.add(walk);
      for (let d = -ISLAND + 12; d < ISLAND - 8; d += 18) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? 7 : 0.5, horiz ? 0.5 : 7), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horiz ? d : r, 0.07, horiz ? r : d); group.add(dash);
      }
    }
  }

  // Buildings, one per block slot, styled by district.
  const palettes = {
    downtown: [0xd9dee8, 0xb9c6d8, 0xe8d9c0, 0x9fb4cc], midtown: [0xe6d3b3, 0xd8b8a0, 0xc9d4c5],
    oldtown: [0xe0aa7e, 0xd98f6a, 0xc97b5a], marina: [0xf0ead8, 0xdce8ee], hills: [0xf2e6d0, 0xe8dcc8],
    port: [0x8a8f96, 0x7a6a58, 0x9a8a76], beach: [0xf5eedd],
  };
  const heights = { downtown: [38, 78], midtown: [14, 30], oldtown: [9, 18], marina: [7, 13], hills: [6, 11], port: [10, 16], beach: [5, 8] };
  const edges = [];
  for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
    const cx = (ROADS[i] + ROADS[i + 1]) / 2, cz = (ROADS[j] + ROADS[j + 1]) / 2;
    const district = districtAt(cx, cz);
    if (district === 'beach') continue;
    const slots = district === 'downtown' ? 1 : 2;
    for (let s = 0; s < slots * slots; s++) {
      if (slots > 1 && rand() < 0.22) continue; // gaps become plazas / parking
      const ox = slots === 1 ? 0 : (s % 2 === 0 ? -17 : 17);
      const oz = slots === 1 ? 0 : (s < 2 ? -17 : 17);
      const w = slots === 1 ? 44 + rand() * 14 : 24 + rand() * 8;
      const d = slots === 1 ? 44 + rand() * 14 : 24 + rand() * 8;
      const [hLo, hHi] = heights[district];
      const h = hLo + rand() * (hHi - hLo);
      const winTexScaled = winTex.clone(); winTexScaled.needsUpdate = true;
      winTexScaled.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)));
      const mat = new THREE.MeshLambertMaterial({ color: pick(palettes[district]), emissive: 0xffca7a, emissiveIntensity: 0.34, emissiveMap: winTexScaled });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx + ox, h / 2, cz + oz); group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 1.2, d + 1.5),
        new THREE.MeshLambertMaterial({ color: 0x5a5148 }));
      roof.position.set(cx + ox, h + 0.6, cz + oz); group.add(roof);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      edges.push(b.position);
    }
  }

  // Port cranes and containers.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8642c });
  for (let k = 0; k < 3; k++) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 2), craneMat); leg.position.y = 15; crane.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 2), craneMat); arm.position.set(-12, 30, 0); crane.add(arm);
    crane.position.set(196 + k * 34, 0, -252); group.add(crane);
    colliders.push({ minX: crane.position.x - 2, maxX: crane.position.x + 2, minZ: -254, maxZ: -250 });
    for (let cIdx = 0; cIdx < 4; cIdx++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 4),
        new THREE.MeshLambertMaterial({ color: pick([0xc23b2e, 0x2e7ac2, 0x3fa34d, 0xd8a02c]) }));
      box.position.set(180 + rand() * 90, 2, -228 + rand() * 26); group.add(box);
      colliders.push({ minX: box.position.x - 5, maxX: box.position.x + 5, minZ: box.position.z - 2, maxZ: box.position.z + 2 });
    }
  }

  // Marina docks reaching into the water on the west shore.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  for (let k = 0; k < 4; k++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 5), dockMat);
    dock.position.set(-ISLAND - 16, 0.4, 10 + k * 34); group.add(dock);
    const boat = new THREE.Mesh(new THREE.BoxGeometry(12, 2.4, 4),
      new THREE.MeshLambertMaterial({ color: pick([0xf2f2f2, 0x2e7ac2, 0xe2543e]) }));
    boat.position.set(-ISLAND - 26, 0.2, 16 + k * 34); group.add(boat);
  }

  // Palm trees: instanced trunks and crowns scattered off-road.
  const palmSpots = [];
  while (palmSpots.length < 150) {
    const x = (rand() * 2 - 1) * (ISLAND - 12), z = (rand() * 2 - 1) * (ISLAND - 12);
    if (ROADS.some(r => Math.abs(x - r) < 11) || ROADS.some(r => Math.abs(z - r) < 11)) continue;
    if (colliders.some(c => x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3)) continue;
    palmSpots.push({ x, z, s: 0.8 + rand() * 0.7, lean: (rand() - 0.5) * 0.24 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 8, 6); trunkGeo.translate(0, 4, 0);
  const crownGeo = new THREE.ConeGeometry(4.4, 2.2, 8); crownGeo.translate(0, 8.6, 0); crownGeo.scale(1, 0.55, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x9a7a52 }), palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x3f9e4d }), palmSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  palmSpots.forEach((p, idx) => {
    e.set(p.lean, rand() * Math.PI, 0); q.setFromEuler(e); v.set(p.x, 0, p.z); sc.set(p.s, p.s, p.s);
    m4.compose(v, q, sc); trunks.setMatrixAt(idx, m4); crowns.setMatrixAt(idx, m4);
    colliders.push({ minX: p.x - 0.7, maxX: p.x + 0.7, minZ: p.z - 0.7, maxZ: p.z + 0.7 });
  });
  group.add(trunks); group.add(crowns);

  // Street lights along the roads (emissive heads read as dusk lamps).
  const lampGeo = new THREE.CylinderGeometry(0.14, 0.14, 6, 5); lampGeo.translate(0, 3, 0);
  const headGeo = new THREE.SphereGeometry(0.42, 6, 5); headGeo.translate(0, 6.1, 0);
  const lampSpots = [];
  for (const r of ROADS) for (let d = -ISLAND + 26; d < ISLAND; d += 52) { lampSpots.push({ x: r + 9, z: d }); lampSpots.push({ x: d, z: r - 9 }); }
  const lampPoles = new THREE.InstancedMesh(lampGeo, new THREE.MeshLambertMaterial({ color: 0x44484f }), lampSpots.length);
  const lampHeads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd98a }), lampSpots.length);
  lampSpots.forEach((p, idx) => { m4.makeTranslation(p.x, 0, p.z); lampPoles.setMatrixAt(idx, m4); lampHeads.setMatrixAt(idx, m4); });
  group.add(lampPoles); group.add(lampHeads);

  // Mission / shop marker pillars are managed by missions.js; the city just
  // exposes a helper for a glowing objective column.
  function makeMarker(color = 0xffd23e) {
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 46, 14, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.position.y = 23; mesh.visible = false;
    scene.add(mesh); return mesh;
  }

  let t = 0;
  function update(dt) {
    t += dt;
    const pos = oceanGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = oceanBase[i * 3], y = oceanBase[i * 3 + 1];
      pos.setZ(i, Math.sin(x * 0.02 + t * 0.9) * 0.55 + Math.cos(y * 0.017 + t * 0.7) * 0.55);
    }
    pos.needsUpdate = true;
    sunBall.position.y = 120 + Math.sin(t * 0.05) * 2;
  }

  /** Push a circle (x, z, radius) out of every building collider; returns corrected point. */
  function collide(x, z, radius) {
    for (const c of colliders) {
      if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) {
        const dxl = x - (c.minX - radius), dxr = (c.maxX + radius) - x;
        const dzl = z - (c.minZ - radius), dzr = (c.maxZ + radius) - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = c.minX - radius; else if (m === dxr) x = c.maxX + radius;
        else if (m === dzl) z = c.minZ - radius; else z = c.maxZ + radius;
      }
    }
    return { x: clamp(x, -ISLAND - 40, ISLAND + 40), z: clamp(z, -ISLAND - 40, ISLAND + 46) };
  }
  /** True when the circle overlaps a collider (used to detect a building hit). */
  function hitsCollider(x, z, radius) {
    return colliders.some(c => x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius);
  }

  return { group, colliders, update, collide, hitsCollider, makeMarker };
}
