// When an animal is out, and when it calls. Hours are clock hours (0–24); a window may wrap midnight.

/** [from hour, to hour, strength 0..1]. */
export type Window = readonly [number, number, number];

const EDGE_H = 0.25; // a quarter of an hour of fade at each end, so nothing snaps on

function inWindow(hour: number, from: number, to: number): number {
  const h = ((hour % 24) + 24) % 24;
  const len = (((to - from) % 24) + 24) % 24 || 24;
  const into = (((h - from) % 24) + 24) % 24;
  if (into > len) {
    // Outside: allow the fade just before the start.
    const before = 24 - into;
    return before < EDGE_H ? 1 - before / EDGE_H : 0;
  }
  const left = len - into;
  return left < EDGE_H ? left / EDGE_H : 1;
}

/** Strength 0..1 of a set of windows at a clock hour (the strongest window wins). */
export function strengthAt(windows: readonly Window[], hour: number): number {
  let best = 0;
  for (const [from, to, s] of windows) best = Math.max(best, s * inWindow(hour, from, to));
  return best;
}

/** First clock hour, searching forward from 17:00 in steps of a minute, at which the windows are on. */
export function firstOnsetAfter(windows: readonly Window[], startHour: number, threshold = 0.5): number | null {
  for (let m = 0; m < 24 * 60; m++) {
    const h = startHour + m / 60;
    if (strengthAt(windows, h) >= threshold) return h % 24;
  }
  return null;
}
