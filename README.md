# AZURA HEAT

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fadliferdian74-lgtm/azura-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fadliferdian74-lgtm/azura-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game in the browser — no downloads, no assets,
everything procedural. Welcome to **Port Azura**, a sun-soaked island city at
golden hour, where the sunset is warm and the police are warmer.

## The story

Dario Venn was the coast's best wheelman until one job went wrong. He returns
to Port Azura broke, with handler **Selene Marchetti** feeding him jobs, chop-shop
owner **Primo Almeida** buying what he lifts, and port boss **Viktor Halden**
running the docks — and half the police — from the shadows. Eight story jobs
take Dario from stealing his first sports car to cracking Halden's marina vault
at five stars with a helicopter overhead.

## Features

- **A living island city, generated from a seed** — road grid, six districts
  (Downtown towers, Marina, Old Town, Beach strip, the Port, Palm Hills),
  lit-window buildings, palm trees, beach and an animated ocean.
- **On foot and behind the wheel** — third-person character with walk/sprint
  animation, mouse-orbit camera, and arcade driving with drifting, NOS flames,
  damage smoke and a chase camera.
- **Traffic and pedestrians** — lane-following AI traffic that brakes for
  obstacles and turns at junctions; citizens who stroll the sidewalks and flee
  from fast cars and gunfire.
- **A real wanted system** — five stars, witnessed crimes, line-of-sight decay,
  ramming pursuit cars, roadblocks at 3+ stars, a searchlight helicopter at 4+,
  and BUSTED / WASTED endings with cash penalties.
- **Gunplay** — pistol and SMG with tracers, muzzle flash, hit sparks and
  enemies who shoot back.
- **Eight story missions** — car theft and delivery, a timed package run, a
  wanted-level escape, a dockside shootout, a checkpoint grand prix against two
  AI racers, an armored convoy hit, a fragile five-star delivery, and the vault
  finale.
- **Economy and saves** — cash rewards, a paint shop that repairs, resprays and
  clears your heat, and safehouse saving to localStorage.
- **Synthesized radio** — three WebAudio stations (Azura Wave FM, Radio Sol,
  Palma Chill) plus engine, skid, siren and gunshot effects. Zero audio files.
- **Full HUD** — live minimap with traffic/police/mission blips, wanted stars,
  health, cash, speedometer, dialogue boxes and objective markers.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive (steer with A and D) |
| Mouse | Orbit camera, aim |
| E | Enter / exit car |
| Shift | Sprint on foot / NOS in a car |
| Space | Handbrake (drift) |
| 1 / 2 | Pistol / SMG |
| Click | Shoot |
| R | Cycle radio station (in a car) |
| Esc / P | Pause |

Follow the gold beacon for the next job. Drive into the paint shop to repair
and recolor your car (it also clears your wanted level), and step into the
Palm Hills safehouse to save.

## Run it locally

Requires Node 22. From the repository root:

```sh
node serve.ts
```

Then open the printed URL in a browser. The game itself is plain ES modules
under `game/` with three.js vendored alongside — no build step and no network
loads at runtime. `node main.ts` packages the game and writes the submission
dossier to `MAKEFUN_OUTPUT_DIR`.

## Tech

three.js (vendored), vanilla JavaScript ES modules, WebAudio synthesis,
canvas minimap, deterministic seeded procedural generation.
