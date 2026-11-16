// Small deterministic random source. The whole night (forest, animals, weather, events)
// is generated from one integer seed, so the same night number is the same night for everyone.

export type Rng = {
  /** Uniform in [0, 1). */
  (): number;
  range(lo: number, hi: number): number;
  int(lo: number, hiInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  /** A new independent stream, so adding draws in one system never shifts another. */
  fork(label: string): Rng;
};

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (lo, hi) => lo + (hi - lo) * next();
  rng.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  rng.pick = (items) => items[Math.floor(next() * items.length)]!;
  rng.chance = (p) => next() < p;
  rng.fork = (label) => makeRng((seed ^ hashString(label)) >>> 0);
  return rng;
}

/** Smooth value noise in 2D, deterministic for a seed. Returns [0, 1]. */
export function makeNoise2(seed: number): (x: number, y: number) => number {
  const h = (ix: number, iy: number) => {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy);
    const b = h(ix + 1, iy);
    const c = h(ix, iy + 1);
    const d = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** The night number used when the address has none: days since 1 January 2026, local time. */
export function nightNumberFor(date: Date): number {
  const start = new Date(2026, 0, 1).getTime();
  const noonShift = 12 * 3600 * 1000; // a night belongs to the day it started on
  return Math.max(1, Math.floor((date.getTime() - noonShift - start) / 86400000) + 1);
}
