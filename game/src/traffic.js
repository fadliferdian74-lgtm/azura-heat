// AZURA HEAT — ambient traffic: civilian cars that live on the road grid.
// Each driver follows its lane to the next junction, picks a new heading there,
// and slows or stops for the car ahead, for the player, and at blocked lanes.
import { ROADS, LANE, ISLAND, clamp, angleDelta } from './config.js';
import { CAR_STYLES, createCar, stepCar } from './vehicles.js';

const rand = (() => { let s = 987654321; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

/** Lane target: the point a driver aims for along its current road. */
function laneTarget(car) {
  const dx = -Math.sin(car.heading), dz = -Math.cos(car.heading);
  // Stay in the right-hand lane: offset perpendicular to travel.
  const px = -dz * LANE, pz = dx * LANE;
  return { x: car.x + dx * 30 + px * 0, z: car.z + dz * 30 + pz * 0, px, pz };
}

export function createTraffic(scene, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const style = CAR_STYLES[Math.floor(rand() * CAR_STYLES.length)];
    const horiz = rand() > 0.5;
    const road = ROADS[Math.floor(rand() * ROADS.length)];
    const along = (rand() * 2 - 1) * (ISLAND - 30);
    const dir = rand() > 0.5 ? 1 : -1;
    // Heading along the road, in the right lane for that direction.
    let x, z, heading;
    if (horiz) { heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2; x = along; z = road + (dir > 0 ? -LANE : LANE); }
    else { heading = dir > 0 ? Math.PI : 0; x = road + (dir > 0 ? LANE : -LANE); z = along; }
    const car = createCar(style, x, z, heading);
    car.cruise = 10 + rand() * 5;
    car.turnAt = null;
    scene.add(car.mesh);
    cars.push(car);
  }
  return { cars };
}

/** Distance to the nearest junction ahead, so drivers can plan a turn. */
function junctionAhead(car) {
  const dx = -Math.sin(car.heading), dz = -Math.cos(car.heading);
  let best = Infinity;
  for (const r of ROADS) {
    const t = Math.abs(dx) > 0.5 ? (r - car.x) / dx : (r - car.z) / dz;
    if (t > 4 && t < best) best = t;
  }
  return best;
}

export function updateTraffic(traffic, dt, obstacles) {
  for (const car of traffic.cars) {
    // Plan turns near junctions.
    const j = junctionAhead(car);
    if (j < 9 && !car.turnCooldown) {
      car.turnCooldown = 3 + rand() * 4;
      const choice = rand();
      if (choice < 0.35) car.wantTurn = 1; else if (choice < 0.7) car.wantTurn = -1; else car.wantTurn = 0;
    }
    car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);
    let steer = 0;
    if (car.wantTurn && j < 16) { steer = car.wantTurn; if (j < 5) car.wantTurn = 0; }
    // Keep to the lane centre of the road we are on.
    const onH = ROADS.some(r => Math.abs(car.z - r) < 9);
    const onV = ROADS.some(r => Math.abs(car.x - r) < 9);
    // Obstacle check: anything slow or stopped within 9 units ahead.
    let blocked = false;
    const fx = car.x - Math.sin(car.heading) * 9, fz = car.z - Math.cos(car.heading) * 9;
    for (const o of obstacles) {
      if (o === car) continue;
      if (Math.hypot(o.x - fx, o.z - fz) < 5.2) { blocked = true; break; }
    }
    let throttle = blocked ? (car.speed > 0.5 ? -1 : 0) : 1;
    if (car.speed > car.cruise) throttle = 0;
    stepCar(car, { throttle, steer, handbrake: false, nos: false }, dt);
    // Wrap drivers who leave the island back onto the grid.
    if (Math.abs(car.x) > ISLAND + 20 || Math.abs(car.z) > ISLAND + 20) {
      const road = ROADS[Math.floor(rand() * ROADS.length)];
      car.x = road + LANE; car.z = (rand() * 2 - 1) * ISLAND * 0.7; car.heading = Math.PI; car.speed = 0;
    }
    void onH; void onV; void laneTarget;
  }
}
