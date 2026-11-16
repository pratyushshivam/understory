// The forest for one night, generated from the night number. Nothing here touches the
// renderer: the same function feeds the tests, so the rules below are checked, not hoped for.

import { makeNoise2, makeRng, type Rng } from './rng.ts';
import type { Animal, Liana, Log, NightEvent, Perch, Plant, Species, Tree } from './types.ts';

/** The walkable patch: a 200 m square, four hectares, with the river along its north side. */
export const SITE = {
  half: 100,
  /** North of this line (smaller z) the bank falls to the river. */
  riverZ: -74,
  waterY: -2.2,
  start: { x: 4, z: 72 },
  /** Trees at least 10 cm thick per hectare: the count in the 25-ha Yasuní plot (Valencia et al. 2004). */
  stemsPerHectare: 702,
  /** Share of those trees that are the stilt palm Iriartea deltoidea, the commonest of them (same paper). */
  palmShare: 0.103,
} as const;

/** Centre line of the forest stream: it wanders north to the river. */
export function streamX(z: number): number {
  return 46 + 14 * Math.sin(z / 27) + 6 * Math.sin(z / 11 + 1.3);
}

export function distanceToStream(x: number, z: number): number {
  return Math.abs(x - streamX(z));
}

/**
 * Tree height in metres from trunk diameter in centimetres: the Weibull height–diameter curve
 * fitted for western Amazonia by Feldpausch et al. (2012), H = a·(1 − exp(−b·D^c)).
 */
export function treeHeight(dbhCm: number): number {
  return 46.263 * (1 - Math.exp(-0.0876 * Math.pow(dbhCm, 0.6072)));
}

export type World = {
  seed: number;
  trees: Tree[];
  plants: Plant[];
  logs: Log[];
  lianas: Liana[];
  animals: Animal[];
  events: NightEvent[];
  heightAt: (x: number, z: number) => number;
  /** Index of the animal the first goal sends you to (a calling potoo), or -1. */
  questAnimal: number;
};

export function makeHeight(seed: number): (x: number, z: number) => number {
  const n = makeNoise2(seed ^ 0x51ed);
  return (x, z) => {
    let h = (n(x / 34, z / 34) - 0.5) * 2.6 + (n(x / 9, z / 9) - 0.5) * 0.5;
    // The stream cuts a shallow gully.
    const ds = distanceToStream(x, z);
    if (ds < 5) h -= 0.9 * (1 - ds / 5) ** 2 + (ds < 1.2 ? 0.25 : 0);
    // The bank falls away to the river.
    if (z < SITE.riverZ + 10) {
      const k = Math.min(1, (SITE.riverZ + 10 - z) / 14);
      h = h * (1 - k) + (SITE.waterY - 0.8) * k * k * (3 - 2 * k) + h * 0;
    }
    return h;
  };
}

function isLand(x: number, z: number): boolean {
  return z > SITE.riverZ + 2 && distanceToStream(x, z) > 2.2;
}

function growTrees(rng: Rng): Tree[] {
  const landHa = ((SITE.half * 2) * (SITE.half - SITE.riverZ)) / 10000;
  const target = Math.round(SITE.stemsPerHectare * landHa);
  const trees: Tree[] = [];
  const cell = 4;
  const grid = new Map<number, number[]>();
  const key = (x: number, z: number) => Math.floor((x + 200) / cell) * 1000 + Math.floor((z + 200) / cell);
  let guard = 0;
  while (trees.length < target && guard++ < target * 30) {
    const x = rng.range(-SITE.half, SITE.half);
    const z = rng.range(SITE.riverZ + 2, SITE.half);
    if (!isLand(x, z)) continue;
    if (Math.hypot(x - SITE.start.x, z - SITE.start.z) < 2.5) continue;
    // Diameters: many thin stems, few giants. A fitted curve, not the plot's own tally.
    let dbhCm = 10 - 9 * Math.log(1 - rng());
    const emergent = rng.chance(0.012);
    if (emergent) dbhCm = rng.range(90, 180);
    dbhCm = Math.min(dbhCm, 180);
    const palm = !emergent && dbhCm < 32 && rng.chance(SITE.palmShare / 0.91);
    if (palm) dbhCm = rng.range(12, 24);
    const dbh = dbhCm / 100;
    // Keep trunks from growing into each other.
    let ok = true;
    const gx = Math.floor((x + 200) / cell);
    const gz = Math.floor((z + 200) / cell);
    for (let i = -1; i <= 1 && ok; i++)
      for (let j = -1; j <= 1 && ok; j++) {
        const list = grid.get((gx + i) * 1000 + gz + j);
        if (!list) continue;
        for (const t of list) {
          const o = trees[t]!;
          if (Math.hypot(o.x - x, o.z - z) < (o.dbh + dbh) * 1.6 + 0.7) ok = false;
        }
      }
    if (!ok) continue;
    let height = treeHeight(dbhCm) * rng.range(0.88, 1.12);
    if (palm) height = rng.range(15, 25);
    if (emergent) height = rng.range(40, 50);
    const crownRadius = palm ? 2.6 : Math.min(15, 1.2 + dbhCm * 0.085 * rng.range(0.85, 1.2));
    const k = key(x, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(trees.length);
    trees.push({
      x,
      z,
      dbh,
      height,
      crownRadius,
      kind: emergent ? 'emergent' : palm ? 'palm' : 'broadleaf',
      buttress: !palm && dbhCm > 55,
      tint: rng(),
    });
  }
  return trees;
}

function growPlants(rng: Rng, perSquareMetre: number): Plant[] {
  const plants: Plant[] = [];
  const noise = makeNoise2(9173);
  const n = Math.round(perSquareMetre * (SITE.half * 2) * (SITE.half - SITE.riverZ));
  for (let i = 0; i < n; i++) {
    const x = rng.range(-SITE.half, SITE.half);
    const z = rng.range(SITE.riverZ + 1, SITE.half);
    if (distanceToStream(x, z) < 1.4) continue;
    // Plants grow in patches: light gaps and damp ground hold more of them.
    const patch = noise(x / 13, z / 13);
    if (rng() > 0.25 + patch * 0.9) continue;
    const nearWater = distanceToStream(x, z) < 6 || z < SITE.riverZ + 8;
    const kind = nearWater && rng.chance(0.5) ? 3 : rng.int(0, 2);
    plants.push({ x, z, kind, scale: rng.range(0.6, 1.5), rot: rng.range(0, Math.PI * 2) });
  }
  return plants;
}

function dropLogs(rng: Rng): Log[] {
  const logs: Log[] = [];
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-SITE.half + 4, SITE.half - 4);
    const z = rng.range(SITE.riverZ + 6, SITE.half - 4);
    if (!isLand(x, z)) continue;
    logs.push({
      x,
      z,
      rot: rng.range(0, Math.PI),
      length: rng.range(3, 9),
      radius: rng.range(0.14, 0.42),
      fungi: rng.chance(0.4),
    });
  }
  return logs;
}

function hangLianas(rng: Rng, trees: Tree[]): Liana[] {
  const out: Liana[] = [];
  trees.forEach((t) => {
    if (t.kind === 'palm' || t.dbh < 0.28) return;
    const n = t.dbh > 0.6 ? rng.int(1, 3) : rng.chance(0.35) ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = t.dbh / 2 + rng.range(0.5, 3.2);
      out.push({
        x: t.x + Math.cos(a) * r,
        z: t.z + Math.sin(a) * r,
        top: Math.min(t.height * 0.7, rng.range(9, 20)),
        sway: rng(),
        dx: -Math.cos(a) * rng.range(0.2, 1.6),
        dz: -Math.sin(a) * rng.range(0.2, 1.6),
      });
    }
  });
  return out;
}

/** Height range in metres above the ground that each perch allows. Checked by the tests. */
export const PERCH_HEIGHT: Record<Perch, readonly [number, number]> = {
  litter: [0, 0.05],
  trunk: [0.2, 3],
  understory: [0.4, 5],
  midstory: [5, 15],
  canopy: [18, 50],
  log: [0.1, 0.6],
  stream: [0, 0.3],
  riverbank: [0, 0.4],
  water: [0, 0],
  air: [1.5, 12],
  'air-river': [0.3, 30],
};

function placeAnimals(rng: Rng, species: readonly Species[], world: Omit<World, 'animals' | 'events' | 'questAnimal'>): Animal[] {
  const { trees, logs, heightAt } = world;
  const big = trees.map((t, i) => (t.dbh > 0.3 && t.kind !== 'palm' ? i : -1)).filter((i) => i >= 0);
  const slim = trees.map((t, i) => (t.dbh <= 0.3 ? i : -1)).filter((i) => i >= 0);
  const tall = trees.map((t, i) => (t.height > 24 && t.kind !== 'palm' ? i : -1)).filter((i) => i >= 0);
  const animals: Animal[] = [];
  const clampH = (perch: Perch, lo: number, hi: number): [number, number] => {
    const [a, b] = PERCH_HEIGHT[perch];
    return [Math.max(lo, a), Math.max(Math.max(lo, a), Math.min(hi, b))];
  };
  for (const sp of species) {
    const r = rng.fork(sp.id);
    const n = r.int(sp.count[0], sp.count[1]);
    for (let k = 0; k < n; k++) {
      const perch = r.pick(sp.perch);
      const [lo, hi] = clampH(perch, sp.height[0], sp.height[1]);
      let x = 0;
      let z = 0;
      let y = 0;
      let tree = -1;
      let heading = r.range(0, Math.PI * 2);
      for (let attempt = 0; attempt < 40; attempt++) {
        tree = -1;
        if (perch === 'litter') {
          x = r.range(-SITE.half + 3, SITE.half - 3);
          z = r.range(SITE.riverZ + 6, SITE.half - 3);
          if (!isLand(x, z)) continue;
          y = heightAt(x, z) + lo;
        } else if (perch === 'trunk' || perch === 'understory' || perch === 'midstory' || perch === 'canopy') {
          const pool = perch === 'trunk' ? big : perch === 'understory' ? slim : tall;
          if (pool.length === 0) break;
          tree = r.pick(pool);
          const t = trees[tree]!;
          const above = r.range(lo, hi);
          if (perch !== 'trunk' && above > t.height - 1) continue;
          const a = r.range(0, Math.PI * 2);
          const out = perch === 'trunk' ? t.dbh / 2 + 0.02 : perch === 'canopy' ? r.range(0.5, t.crownRadius * 0.6) : r.range(0.5, 1.4);
          x = t.x + Math.cos(a) * out;
          z = t.z + Math.sin(a) * out;
          y = heightAt(t.x, t.z) + above;
          heading = a;
        } else if (perch === 'log') {
          if (logs.length === 0) break;
          const l = r.pick(logs);
          const along = r.range(-0.4, 0.4) * l.length;
          x = l.x + Math.cos(l.rot) * along;
          z = l.z + Math.sin(l.rot) * along;
          y = heightAt(x, z) + Math.min(hi, Math.max(lo, l.radius * 1.7));
        } else if (perch === 'stream') {
          z = r.range(SITE.riverZ + 6, SITE.half - 5);
          const side = r.chance(0.5) ? 1 : -1;
          x = streamX(z) + side * r.range(0.9, 2.0);
          y = heightAt(x, z) + lo;
          heading = side > 0 ? Math.PI : 0;
        } else if (perch === 'riverbank') {
          x = r.range(-SITE.half + 5, SITE.half - 5);
          z = SITE.riverZ + r.range(-2, 4);
          y = Math.max(heightAt(x, z), SITE.waterY) + lo;
          heading = Math.PI / 2 + r.range(-0.6, 0.6);
        } else if (perch === 'water') {
          x = r.range(-SITE.half + 5, SITE.half - 5);
          z = SITE.riverZ - r.range(9, 30);
          y = SITE.waterY;
          heading = Math.PI / 2 + r.range(-0.5, 0.5);
        } else if (perch === 'air') {
          x = r.range(-SITE.half + 10, SITE.half - 10);
          z = r.range(SITE.riverZ + 10, SITE.half - 10);
          y = heightAt(x, z) + r.range(lo, hi);
        } else {
          x = r.range(-SITE.half + 10, SITE.half - 10);
          z = SITE.riverZ - r.range(8, 30);
          y = SITE.waterY + r.range(lo, hi);
        }
        // Nothing sits on the spot where you start.
        if (Math.hypot(x - SITE.start.x, z - SITE.start.z) < 6) continue;
        break;
      }
      animals.push({ index: animals.length, species: sp.id, perch, x, y, z, heading, tree, phase: r() });
    }
  }
  return animals;
}

function planEvents(rng: Rng): NightEvent[] {
  const events: NightEvent[] = [];
  const rainAt = rng.range(215, 285);
  const rainFor = rng.range(58, 78);
  events.push({ kind: 'thunder', at: rainAt - rng.range(22, 30), duration: 6 });
  events.push({ kind: 'thunder', at: rainAt - rng.range(6, 12), duration: 6 });
  events.push({ kind: 'rain', at: rainAt, duration: rainFor });
  events.push({ kind: 'thunder', at: rainAt + rng.range(10, 30), duration: 6 });
  events.push({ kind: 'crack', at: rng.range(120, 195), duration: 2 });
  events.push({ kind: 'treefall', at: rng.range(150, 205), duration: 7 });
  events.push({ kind: 'hush', at: rainAt + rainFor + rng.range(28, 55), duration: 22 });
  events.push({ kind: 'crack', at: rainAt + rainFor + rng.range(80, 110), duration: 2 });
  return events.sort((a, b) => a.at - b.at);
}

export type WorldOptions = { plantsPerSquareMetre?: number };

export function generateWorld(seed: number, species: readonly Species[], options: WorldOptions = {}): World {
  const rng = makeRng(seed);
  const heightAt = makeHeight(seed);
  const trees = growTrees(rng.fork('trees'));
  const plants = growPlants(rng.fork('plants'), options.plantsPerSquareMetre ?? 0.22);
  const logs = dropLogs(rng.fork('logs'));
  const lianas = hangLianas(rng.fork('lianas'), trees);
  const base = { seed, trees, plants, logs, lianas, heightAt };
  const animals = placeAnimals(rng.fork('animals'), species, base);
  // The first goal: the nearest potoo that is between 25 and 60 m from the start is moved
  // nowhere; if none is in that ring, the nearest one is used as it stands.
  let questAnimal = -1;
  let best = Infinity;
  for (const a of animals) {
    if (a.species !== 'common-potoo') continue;
    const d = Math.hypot(a.x - SITE.start.x, a.z - SITE.start.z);
    const score = d >= 25 && d <= 60 ? d : 1000 + d;
    if (score < best) {
      best = score;
      questAnimal = a.index;
    }
  }
  return { ...base, animals, events: planEvents(rng.fork('events')), questAnimal };
}
