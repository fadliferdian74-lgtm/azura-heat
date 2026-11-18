// traffic.js — ambient traffic AI. Cars pick a road lane, cruise it, brake for
// obstacles ahead, and sometimes turn at junctions to a crossing road.
import { ROADS, CITY_HALF, rng, dist2d, angleLerp } from './config.js';
import { Vehicle, CAR_COLORS } from './vehicles.js';

const LANE = 5; // right-hand lane offset from road centre

export class TrafficCar {
  constructor(scene, rand) {
    this.axis = rand() < 0.5 ? 'x' : 'z';
    this.dir = rand() < 0.5 ? 1 : -1;
    this.road = ROADS[Math.floor(rand() * ROADS.length)];
    const along = -CITY_HALF + rand() * CITY_HALF * 2;
    const x = this.axis === 'x' ? along : this.road + this.dir * LANE;
    const z = this.axis === 'x' ? this.road - this.dir * LANE : along;
    this.car = new Vehicle(scene, x, z, this.headingFor(), CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], 'sedan');
    this.car.driver = 'traffic';
    this.cruiseSpeed = 13 + rand() * 8;
    this.rand = rand;
  }
  headingFor() {
    // car forward is local -Z; heading such that forward matches travel dir
    if (this.axis === 'x') return this.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    return this.dir > 0 ? Math.PI : 0;
  }
  update(dt, obstacles) {
    const c = this.car;
    // obstacle scan straight ahead
    let target = this.cruiseSpeed;
    const fx = -Math.sin(c.heading), fz = -Math.cos(c.heading);
    for (const o of obstacles) {
      if (o === c) continue;
      const dx = o.x - c.x, dz = o.z - c.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 13 && side < 3.2) { target = ahead < 6 ? 0 : Math.min(target, 5); break; }
    }
    c.cruise(dt, target);
    // junction turning: when crossing a perpendicular road, maybe switch axis
    const along = this.axis === 'x' ? c.x : c.z;
    for (const r of ROADS) {
      if (Math.abs(along - r) < 1.2 && this.rand() < 0.012) {
        const newRoad = this.axis === 'x' ? c.z : c.x;
        this.axis = this.axis === 'x' ? 'z' : 'x';
        if (this.rand() < 0.5) this.dir = -this.dir;
        this.road = Math.round(newRoad / 70) * 70;
        break;
      }
    }
    // steer back onto lane centre + heading
    const want = this.headingFor();
    c.heading = angleLerp(c.heading, want, Math.min(1, dt * 3));
    if (this.axis === 'x') c.mesh.position.z += ((this.road - this.dir * LANE) - c.z) * dt * 2.2;
    else c.mesh.position.x += ((this.road + this.dir * LANE) - c.x) * dt * 2.2;
    // wrap around the island edge
    if (Math.abs(c.x) > CITY_HALF + 30 || Math.abs(c.z) > CITY_HALF + 30) {
      if (this.axis === 'x') c.mesh.position.x = -Math.sign(c.x) * (CITY_HALF + 20);
      else c.mesh.position.z = -Math.sign(c.z) * (CITY_HALF + 20);
    }
    c.sync();
  }
}

export function spawnTraffic(scene, count = 11) {
  const rand = rng(2024);
  const list = [];
  for (let i = 0; i < count; i++) list.push(new TrafficCar(scene, rand));
  return list;
}
export { dist2d };

// Remove a wrecked traffic car from the world and from the traffic list.
export function pruneTraffic(scene, list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].car.dead) { list[i].car.remove(scene); list.splice(i, 1); }
  }
}
