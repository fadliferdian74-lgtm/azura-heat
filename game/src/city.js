// city.js — procedural Port Azura: island, ocean, road grid, six districts of
// buildings with lit windows, palms, beach and the working port.
import * as THREE from 'three';
import { ROADS, ROAD_W, CITY_HALF, COLORS, rng, districtAt } from './config.js';

function windowTexture(rand, base) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 120; y += 10) for (let x = 6; x < 58; x += 10) {
    const lit = rand() < 0.55;
    g.fillStyle = lit ? (rand() < 0.5 ? '#ffd98a' : '#fff3c4') : '#2b3542';
    g.fillRect(x, y, 6, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const rand = rng(42);
  const group = new THREE.Group(); scene.add(group);
  const colliders = [];   // {x,z,r} circles for buildings/props
  const anim = { water: null, t: 0 };

  // --- island base: sand disc, city slab, beach ring -----------------------
  const sand = new THREE.Mesh(new THREE.CircleGeometry(478, 48),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.25; group.add(sand);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(CITY_HALF * 2, 1, CITY_HALF * 2),
    new THREE.MeshLambertMaterial({ color: 0x8f9a7d }));
  slab.position.y = -0.5; group.add(slab);

  // --- animated ocean -------------------------------------------------------
  const water = new THREE.Mesh(new THREE.CircleGeometry(1500, 40),
    new THREE.MeshPhongMaterial({ color: COLORS.water, shininess: 120, transparent: true, opacity: 0.94 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.6; group.add(water);
  anim.water = water;

  // --- roads + sidewalks ----------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of ROADS) {
    for (const along of [true, false]) {
      const len = CITY_HALF * 2;
      const road = new THREE.Mesh(new THREE.BoxGeometry(along ? len : ROAD_W, 0.12, along ? ROAD_W : len), roadMat);
      road.position.set(along ? 0 : r, 0.06, along ? r : 0); group.add(road);
      for (const s of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 3, 0.2, along ? 3 : len), walkMat);
        walk.position.set(along ? 0 : r + s * (ROAD_W / 2 + 1.5), 0.1, along ? r + s * (ROAD_W / 2 + 1.5) : 0);
        group.add(walk);
      }
      for (let d = -CITY_HALF + 14; d < CITY_HALF; d += 28) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(along ? 8 : 0.7, 0.05, along ? 0.7 : 8), lineMat);
        dash.position.set(along ? d : r, 0.14, along ? r : d); group.add(dash);
      }
    }
  }

  // --- buildings: one or more per block, height/style by district -----------
  const bases = ['#7d6a5c', '#8c7f72', '#6f7d8c', '#9c8a76', '#5f7086', '#a08b6d'];
  const texes = bases.map(b => windowTexture(rand, b));
  const mats = texes.map(t => new THREE.MeshLambertMaterial({ map: t }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4c4640 });
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
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[Math.floor(rand() * mats.length)]);
      b.position.set(x, h / 2, z); group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), roofMat);
      roof.position.set(x, h + 0.6, z); group.add(roof);
      colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
    }
  }

  // --- palm trees -------------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.palmTrunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: COLORS.palmLeaf, side: THREE.DoubleSide });
  function palm(x, z, s = 1) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = (rand() - 0.5) * 0.16; p.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.6, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.7, 7.4, Math.sin(a) * 1.7);
      leaf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      p.add(leaf);
    }
    p.position.set(x, 0, z); p.scale.setScalar(s); group.add(p);
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

  // --- port cranes + containers ----------------------------------------------
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd86f2e });
  const boxCols = [0xc94f4f, 0x4f7dc9, 0x4fc97d, 0xc9b44f, 0x8a4fc9];
  for (const cx of [-120, 0, 120]) {
    const crane = new THREE.Group();
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat); leg1.position.set(-10, 17, 0);
    const leg2 = leg1.clone(); leg2.position.x = 10;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 3, 3), craneMat); beam.position.y = 34;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), craneMat); cab.position.set(14, 31, 0);
    crane.add(leg1, leg2, beam, cab); crane.position.set(cx, 0, 285); group.add(crane);
    colliders.push({ x: cx - 10, z: 285, r: 3 }, { x: cx + 10, z: 285, r: 3 });
    for (let i = 0; i < 7; i++) {
      const cont = new THREE.Mesh(new THREE.BoxGeometry(11, 4.4, 4.6),
        new THREE.MeshLambertMaterial({ color: boxCols[Math.floor(rand() * boxCols.length)] }));
      cont.position.set(cx - 26 + rand() * 52, 2.2 + (rand() < 0.3 ? 4.4 : 0), 252 + rand() * 22);
      group.add(cont); colliders.push({ x: cont.position.x, z: cont.position.z, r: 6 });
    }
  }

  // --- marina boats -------------------------------------------------------------
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (let i = 0; i < 10; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 9), hullMat); hull.position.y = 0.4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9), mastMat); mast.position.y = 5;
    boat.add(hull, mast);
    boat.position.set(300 + (i % 5) * 14, -1, -160 + Math.floor(i / 5) * 46);
    boat.rotation.y = Math.PI / 2; group.add(boat);
  }

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
