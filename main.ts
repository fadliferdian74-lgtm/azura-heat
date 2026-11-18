// AZURA HEAT — make.fun build entry point.
// Copies the finished browser game into the output directory and writes the
// submission dossier describing it. Node 22, standard library only.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// the playable game, exactly as it runs in the browser
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// captured screenshots ride along when they exist
const shotsDir = join(here, 'screenshots');
if (existsSync(shotsDir)) {
  const dest = join(out, 'screenshots');
  mkdirSync(dest, { recursive: true });
  cpSync(shotsDir, dest, { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2));
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
const shotCount = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).length : 0;
console.log(`AZURA HEAT: build written to ${out} (${gameFiles} game files, ${shotCount} screenshots)`);
