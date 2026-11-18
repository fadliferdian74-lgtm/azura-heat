# AZURA HEAT

[![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fadliferdian74-lgtm/azura-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fadliferdian74-lgtm/azura-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game set in **Port Azura**, a sun-soaked island
city at golden hour. You are **Dario Venn**, a wheelman starting over: fixer
**Selene Marchetti** phones in the work, **Primo Almeida** runs the chop shop,
and port boss **Viktor Halden** owns the docks — for now. The **Port Azura PD**
would like a word.

Built with three.js (vendored, no build step, no network loads at runtime) and
plain ES modules. Everything — the city, the music, the sound effects — is
generated in code. No assets from any commercial game.

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

Or open `game/index.html` through any static file server.

**Controls:** WASD move/drive · mouse aim · click shoot · **E** enter/exit car ·
**Shift** sprint / NOS · **Space** handbrake · **1/2** pistol/SMG · **R** radio ·
**M** start next mission · **F** paint shop · **Esc/P** pause.

## What's in the city

- **Procedural island city** — a seeded road grid with six districts (Downtown
  towers, Marina, Old Town, Beach strip, Halden's Port, Palm Hills), lit
  windows, palm trees, docks, cranes and an animated ocean.
- **On foot and behind the wheel** — third-person character with walk/run
  animation; several car styles with arcade physics, drift, NOS with flame,
  damage smoke, and a chase camera.
- **Traffic and pedestrians** — lane-following AI drivers that brake for
  obstacles; citizens who stroll the sidewalks and flee from fast cars and
  gunfire.
- **Five-star wanted system** — witnessed crimes raise the heat; Port Azura PD
  interceptors pursue and box you in, roadblocks appear at 3+ stars, and a
  police helicopter with a searchlight joins at 4+. Hide to cool off, or get
  **BUSTED** / **WASTED** and pay the fine.
- **Combat** — pistol and SMG with tracers, muzzle flash and hit sparks;
  Halden's men shoot back.
- **Eight story missions** — First Wheels, Package Run, Heat Check, Dockside
  Diplomacy, the Palm Street Grand Prix, Convoy Hit, Skyline Run, and The
  Last Job at the marina vault.
- **Economy and saves** — cash rewards, a safehouse that saves progress
  (localStorage), a hospital, and a paint shop for repairs and resprays.
- **Synthesised radio** — three WebAudio stations (Azura Wave FM, Radio Sol,
  Palma Chill) plus generated engine, skid, siren and gunshot sounds. No audio
  files.

## Screenshots

`?shot=cover|chase|mission|beach&seed=1` poses deterministic scenes of the
live game (see `game/src/shots.js`); the four captures live in `screenshots/`.

## Hand-in

`node main.ts` copies `game/` and `screenshots/` to the output directory and
writes the dossier the judges read.
