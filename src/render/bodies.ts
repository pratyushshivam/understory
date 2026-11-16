// Animal bodies, assembled from simple shapes. Stylised, but proportions follow the real
// animal: a potoo is a vertical stump with an eye, a caiman is mostly snout and tail,
// a whip spider is flat with absurdly long legs. Built at length 1, then scaled to true size.

import * as THREE from 'three';
import type { BodyPlan, Species } from '../core/types.ts';
import { at, ball, build, limb, rod, tube, type Part } from './geo.ts';

export type Body = {
  geo: THREE.BufferGeometry;
  /** Eye positions in the animal's own space (already at true size). */
  eyes: Array<[number, number, number]>;
  /** Where its own light sits, for glowing species. */
  lights: Array<[number, number, number]>;
  /** Height of the head, used to aim the card and the sound. */
  head: [number, number, number];
};

type V = [number, number, number];
type Made = { parts: Part[]; eyes: V[]; lights?: V[]; head: V; unit?: number };

const el = (rx: number, ry: number, rz: number, p: V, w = 8, h = 6) => at(ball(1, w, h), p, [0, 0, 0], [rx, ry, rz]);

function legs4(c: number, x: number, zf: number, zb: number, top: number, r: number): Part[] {
  const out: Part[] = [];
  for (const sx of [-1, 1])
    for (const z of [zf, zb]) {
      out.push({ geo: limb([sx * x, top, z], [sx * x * 1.05, top * 0.45, z + 0.02], r, r * 0.8), colour: c });
      out.push({ geo: limb([sx * x * 1.05, top * 0.45, z + 0.02], [sx * x * 1.05, 0, z + 0.05], r * 0.8, r * 0.7), colour: c });
    }
  return out;
}

const plans: Record<BodyPlan, (c1: number, c2: number, sp: Species) => Made> = {
  frog: (c1, c2) => ({
    parts: [
      { geo: el(0.3, 0.2, 0.42, [0, 0.2, 0]), colour: c1 },
      { geo: el(0.26, 0.15, 0.24, [0, 0.25, 0.36]), colour: c1 },
      { geo: el(0.24, 0.1, 0.36, [0, 0.12, 0.05]), colour: c2 },
      ...[-1, 1].flatMap((s) => [
        { geo: el(0.075, 0.075, 0.075, [s * 0.15, 0.37, 0.42]), colour: c1 },
        { geo: limb([s * 0.2, 0.16, -0.3], [s * 0.44, 0.14, -0.02], 0.08, 0.06), colour: c1 },
        { geo: limb([s * 0.44, 0.14, -0.02], [s * 0.3, 0.03, -0.42], 0.055, 0.04), colour: c1 },
        { geo: limb([s * 0.3, 0.03, -0.42], [s * 0.42, 0.02, -0.2], 0.03, 0.045), colour: c1 },
        { geo: limb([s * 0.2, 0.17, 0.3], [s * 0.33, 0.08, 0.36], 0.05, 0.04), colour: c1 },
        { geo: limb([s * 0.33, 0.08, 0.36], [s * 0.3, 0.01, 0.52], 0.035, 0.05), colour: c1 },
      ]),
    ],
    eyes: [
      [-0.16, 0.39, 0.46],
      [0.16, 0.39, 0.46],
    ],
    head: [0, 0.3, 0.4],
  }),
  toad: (c1, c2) => {
    const f = plans.frog(c1, c2, null as never);
    f.parts.push({ geo: el(0.38, 0.22, 0.44, [0, 0.21, -0.02]), colour: c1 });
    for (const s of [-1, 1]) f.parts.push({ geo: el(0.08, 0.05, 0.13, [s * 0.2, 0.36, 0.22]), colour: c2 });
    return f;
  },
  snake: (c1, c2) => ({
    parts: [
      {
        geo: tube(
          [
            [0.02, 0.03, -0.5],
            [0.2, 0.03, -0.36],
            [0.05, 0.03, -0.2],
            [-0.2, 0.03, -0.1],
            [-0.05, 0.035, 0.06],
            [0.18, 0.035, 0.16],
            [0.04, 0.045, 0.3],
            [-0.06, 0.07, 0.4],
            [0, 0.1, 0.5],
          ],
          (t) => 0.036 * (0.25 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.6))) + 0.006,
          40,
          7,
        ),
        colour: c1,
      },
      { geo: el(0.045, 0.03, 0.065, [0, 0.105, 0.53]), colour: c2 },
    ],
    eyes: [
      [-0.035, 0.115, 0.55],
      [0.035, 0.115, 0.55],
    ],
    head: [0, 0.1, 0.5],
  }),
  caiman: (c1, c2) => ({
    parts: [
      { geo: el(0.1, 0.065, 0.27, [0, 0.07, -0.02]), colour: c1 },
      { geo: tube([[0, 0.07, -0.25], [0.02, 0.05, -0.45], [0.08, 0.035, -0.62], [0.16, 0.025, -0.78]], (t) => 0.06 * (1 - t) + 0.008, 12, 6), colour: c1 },
      { geo: el(0.07, 0.042, 0.1, [0, 0.085, 0.3]), colour: c1 },
      { geo: el(0.045, 0.026, 0.13, [0, 0.07, 0.45]), colour: c1 },
      { geo: el(0.02, 0.012, 0.02, [0, 0.092, 0.56]), colour: c2 },
      ...[-1, 1].flatMap((s) => [
        { geo: el(0.024, 0.02, 0.03, [s * 0.042, 0.122, 0.31]), colour: c1 },
        { geo: limb([s * 0.08, 0.06, 0.14], [s * 0.17, 0, 0.18], 0.025, 0.02), colour: c1 },
        { geo: limb([s * 0.08, 0.06, -0.2], [s * 0.18, 0, -0.16], 0.03, 0.02), colour: c1 },
      ]),
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ geo: el(0.03, 0.012, 0.025, [0, 0.132, -0.2 + i * 0.075]), colour: c2 })),
    ],
    eyes: [
      [-0.043, 0.135, 0.325],
      [0.043, 0.135, 0.325],
    ],
    head: [0, 0.1, 0.35],
  }),
  owl: (c1, c2, sp) => ({
    parts: [
      { geo: el(0.27, 0.4, 0.25, [0, 0.44, 0]), colour: c1 },
      { geo: el(0.25, 0.22, 0.23, [0, 0.9, 0.02], 10, 8), colour: c1 },
      { geo: el(0.19, 0.18, 0.06, [0, 0.9, 0.2], 10, 6), colour: c2 },
      { geo: limb([0, 0.9, 0.24], [0, 0.82, 0.3], 0.03, 0.005), colour: 0x2a2620 },
      { geo: el(0.1, 0.03, 0.2, [0, 0.12, -0.2]), colour: c1 },
      ...(sp && sp.id === 'crested-owl'
        ? [-1, 1].map((s) => ({ geo: limb([s * 0.1, 1.02, 0.14], [s * 0.3, 1.2, 0.02], 0.035, 0.008), colour: 0xf2efe6 }))
        : []),
    ],
    eyes: [
      [-0.09, 0.93, 0.25],
      [0.09, 0.93, 0.25],
    ],
    head: [0, 0.9, 0.1],
  }),
  potoo: (c1, c2) => ({
    parts: [
      { geo: el(0.15, 0.46, 0.15, [0, 0.46, 0]), colour: c1 },
      { geo: el(0.15, 0.15, 0.17, [0, 0.96, 0.03]), colour: c1 },
      { geo: limb([0, 0.98, 0.16], [0, 1.02, 0.24], 0.04, 0.006), colour: c2 },
      { geo: limb([0, 0.1, -0.02], [0, -0.38, -0.08], 0.09, 0.05), colour: c2 },
    ],
    eyes: [
      [-0.11, 1.0, 0.11],
      [0.11, 1.0, 0.11],
    ],
    head: [0, 0.96, 0.05],
  }),
  nightjar: (c1, c2) => ({
    parts: [
      { geo: el(0.19, 0.1, 0.46, [0, 0.1, -0.05]), colour: c1 },
      { geo: el(0.14, 0.1, 0.15, [0, 0.13, 0.38]), colour: c1 },
      { geo: el(0.09, 0.02, 0.25, [0, 0.07, -0.55]), colour: c2 },
    ],
    eyes: [
      [-0.1, 0.17, 0.43],
      [0.1, 0.17, 0.43],
    ],
    head: [0, 0.14, 0.4],
  }),
  groundbird: (c1, c2) => ({
    parts: [
      { geo: el(0.24, 0.24, 0.4, [0, 0.52, 0]), colour: c1 },
      { geo: limb([0, 0.62, 0.28], [0, 0.88, 0.42], 0.08, 0.06), colour: c1 },
      { geo: el(0.085, 0.085, 0.1, [0, 0.92, 0.45]), colour: c2 },
      { geo: limb([0, 0.92, 0.52], [0, 0.9, 0.66], 0.03, 0.006), colour: 0x3a3428 },
      ...[-1, 1].flatMap((s) => [{ geo: limb([s * 0.09, 0.32, 0], [s * 0.09, 0, 0.03], 0.025, 0.02), colour: 0x6a6456 }]),
    ],
    eyes: [
      [-0.07, 0.94, 0.5],
      [0.07, 0.94, 0.5],
    ],
    head: [0, 0.92, 0.45],
  }),
  songbird: (c1, c2) => ({
    parts: [
      { geo: el(0.2, 0.2, 0.33, [0, 0.25, 0]), colour: c1 },
      { geo: el(0.14, 0.14, 0.15, [0, 0.41, 0.26]), colour: c2 },
      { geo: limb([0, 0.41, 0.38], [0, 0.39, 0.56], 0.035, 0.006), colour: 0x2c2820 },
      { geo: el(0.08, 0.02, 0.26, [0, 0.24, -0.5]), colour: c1 },
    ],
    eyes: [
      [-0.1, 0.44, 0.32],
      [0.1, 0.44, 0.32],
    ],
    head: [0, 0.41, 0.3],
  }),
  toucan: (c1, c2) => ({
    parts: [
      { geo: el(0.17, 0.2, 0.3, [0, 0.25, 0]), colour: c1 },
      { geo: el(0.12, 0.13, 0.13, [0, 0.43, 0.22]), colour: c1 },
      { geo: el(0.13, 0.13, 0.08, [0, 0.33, 0.24]), colour: c2 },
      { geo: el(0.055, 0.085, 0.3, [0, 0.42, 0.58]), colour: 0x1c1a16 },
      { geo: el(0.057, 0.03, 0.28, [0, 0.49, 0.56]), colour: 0xe8c33c },
      { geo: el(0.07, 0.02, 0.22, [0, 0.2, -0.45]), colour: c1 },
    ],
    eyes: [
      [-0.09, 0.46, 0.28],
      [0.09, 0.46, 0.28],
    ],
    head: [0, 0.43, 0.3],
  }),
  macaw: (c1, c2) => ({
    parts: [
      { geo: el(0.07, 0.07, 0.2, [0, 0, 0]), colour: c1 },
      { geo: el(0.06, 0.06, 0.07, [0, 0.02, 0.22]), colour: c1 },
      { geo: el(0.03, 0.045, 0.04, [0, 0, 0.29]), colour: 0xe9e2d0 },
      { geo: limb([0, 0, -0.15], [0, -0.02, -0.75], 0.03, 0.006), colour: c1 },
      ...[-1, 1].flatMap((s) => [
        { geo: at(new THREE.BoxGeometry(0.28, 0.012, 0.2), [s * 0.2, 0, 0.02]), colour: 0xe3b81c, flap: 1 },
        { geo: at(new THREE.BoxGeometry(0.3, 0.01, 0.15), [s * 0.47, 0, -0.02]), colour: c2, flap: 1 },
      ]),
    ],
    eyes: [],
    head: [0, 0, 0.2],
  }),
  bat: (c1, c2) => ({
    parts: [
      { geo: el(0.06, 0.06, 0.12, [0, 0, 0]), colour: c1 },
      { geo: el(0.045, 0.045, 0.05, [0, 0.02, 0.12]), colour: c1 },
      ...[-1, 1].flatMap((s) => [
        { geo: limb([s * 0.03, 0.06, 0.13], [s * 0.05, 0.11, 0.13], 0.02, 0.004), colour: c1 },
        { geo: at(new THREE.BoxGeometry(0.22, 0.006, 0.2), [s * 0.16, 0, 0]), colour: c2, flap: 1 },
        { geo: at(new THREE.BoxGeometry(0.22, 0.005, 0.14), [s * 0.38, 0, -0.01]), colour: c2, flap: 1 },
      ]),
    ],
    eyes: [],
    head: [0, 0, 0.1],
  }),
  cat: (c1, c2) => ({
    parts: [
      { geo: el(0.15, 0.16, 0.4, [0, 0.43, 0]), colour: c1 },
      { geo: el(0.13, 0.13, 0.15, [0, 0.55, 0.46], 10, 8), colour: c1 },
      { geo: el(0.07, 0.06, 0.08, [0, 0.5, 0.58]), colour: c2 },
      ...[-1, 1].map((s) => ({ geo: limb([s * 0.09, 0.64, 0.42], [s * 0.11, 0.73, 0.4], 0.04, 0.012), colour: c1 })),
      ...legs4(c1, 0.1, 0.3, -0.3, 0.36, 0.055),
      { geo: tube([[0, 0.46, -0.38], [0, 0.3, -0.62], [0.03, 0.22, -0.85], [0.06, 0.3, -1.02]], () => 0.032, 12, 6), colour: c1 },
      ...Array.from({ length: 26 }, (_, i) => ({
        geo: el(0.03, 0.025, 0.035, [Math.sin(i * 2.4) * 0.14, 0.43 + Math.cos(i * 2.4) * 0.14, -0.34 + (i / 26) * 0.7], 5, 4),
        colour: 0x1a1612,
      })),
    ],
    eyes: [
      [-0.06, 0.59, 0.585],
      [0.06, 0.59, 0.585],
    ],
    head: [0, 0.56, 0.5],
  }),
  monkey: (c1, c2) => ({
    parts: [
      { geo: el(0.17, 0.27, 0.19, [0, 0.3, 0]), colour: c1 },
      { geo: el(0.13, 0.13, 0.13, [0, 0.67, 0.08], 10, 8), colour: c1 },
      { geo: el(0.085, 0.09, 0.05, [0, 0.66, 0.19]), colour: c2 },
      ...[-1, 1].flatMap((s) => [
        { geo: limb([s * 0.15, 0.48, 0.05], [s * 0.2, 0.2, 0.2], 0.045, 0.035), colour: c1 },
        { geo: limb([s * 0.2, 0.2, 0.2], [s * 0.12, 0.0, 0.18], 0.035, 0.03), colour: c1 },
        { geo: limb([s * 0.12, 0.12, 0], [s * 0.2, 0.2, 0.22], 0.055, 0.04), colour: c1 },
        { geo: limb([s * 0.2, 0.2, 0.22], [s * 0.14, 0, 0.1], 0.04, 0.03), colour: c1 },
      ]),
      { geo: tube([[0, 0.1, -0.15], [0, -0.2, -0.24], [0.02, -0.55, -0.2], [0.06, -0.8, -0.12]], () => 0.03, 12, 6), colour: c1 },
    ],
    eyes: [
      [-0.05, 0.69, 0.215],
      [0.05, 0.69, 0.215],
    ],
    head: [0, 0.67, 0.1],
  }),
  kinkajou: (c1, c2) => ({
    parts: [
      { geo: el(0.12, 0.12, 0.36, [0, 0.2, 0]), colour: c1 },
      { geo: el(0.11, 0.1, 0.12, [0, 0.27, 0.42], 10, 8), colour: c1 },
      { geo: el(0.05, 0.045, 0.06, [0, 0.24, 0.52]), colour: c2 },
      ...[-1, 1].map((s) => ({ geo: el(0.035, 0.035, 0.015, [s * 0.1, 0.33, 0.38]), colour: c2 })),
      ...legs4(c1, 0.09, 0.25, -0.25, 0.15, 0.04),
      { geo: tube([[0, 0.2, -0.34], [0, 0.1, -0.6], [0.05, -0.08, -0.72], [0.1, -0.12, -0.55], [0.05, 0.0, -0.45]], () => 0.035, 14, 6), colour: c1 },
    ],
    eyes: [
      [-0.055, 0.3, 0.515],
      [0.055, 0.3, 0.515],
    ],
    head: [0, 0.27, 0.45],
  }),
  rodent: (c1, c2) => ({
    parts: [
      { geo: el(0.19, 0.19, 0.42, [0, 0.3, 0]), colour: c1 },
      { geo: el(0.12, 0.12, 0.18, [0, 0.33, 0.48]), colour: c1 },
      ...legs4(c1, 0.11, 0.26, -0.26, 0.2, 0.04),
      ...[-1, 1].flatMap((s) =>
        [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [
          { geo: el(0.022, 0.022, 0.03, [s * 0.185, 0.33, -0.3 + i * 0.1], 5, 4), colour: c2 },
          { geo: el(0.02, 0.02, 0.028, [s * 0.175, 0.24, -0.26 + i * 0.1], 5, 4), colour: c2 },
        ]),
      ),
      ...[-1, 1].map((s) => ({ geo: el(0.03, 0.04, 0.015, [s * 0.09, 0.45, 0.42]), colour: c1 })),
    ],
    eyes: [
      [-0.1, 0.39, 0.56],
      [0.1, 0.39, 0.56],
    ],
    head: [0, 0.35, 0.5],
  }),
  tapir: (c1, c2) => ({
    parts: [
      { geo: el(0.2, 0.22, 0.48, [0, 0.52, 0], 10, 8), colour: c1 },
      { geo: el(0.12, 0.14, 0.2, [0, 0.58, 0.56]), colour: c1 },
      { geo: limb([0, 0.55, 0.7], [0, 0.4, 0.86], 0.06, 0.035), colour: c1 },
      { geo: el(0.05, 0.09, 0.3, [0, 0.74, 0.3]), colour: 0x2a221a },
      ...[-1, 1].flatMap((s) => [
        { geo: el(0.04, 0.055, 0.02, [s * 0.1, 0.74, 0.5]), colour: c1 },
        { geo: el(0.025, 0.02, 0.012, [s * 0.1, 0.79, 0.5]), colour: c2 },
      ]),
      ...legs4(c1, 0.12, 0.3, -0.3, 0.4, 0.065),
    ],
    eyes: [
      [-0.105, 0.63, 0.66],
      [0.105, 0.63, 0.66],
    ],
    head: [0, 0.6, 0.6],
  }),
  opossum: (c1, c2) => ({
    parts: [
      { geo: el(0.15, 0.15, 0.34, [0, 0.22, 0]), colour: c1 },
      { geo: el(0.09, 0.09, 0.19, [0, 0.24, 0.42]), colour: c2 },
      { geo: el(0.025, 0.025, 0.03, [0, 0.23, 0.61]), colour: 0xd8a0a0 },
      ...[-1, 1].map((s) => ({ geo: el(0.045, 0.055, 0.012, [s * 0.08, 0.34, 0.36]), colour: 0x1c1a18 })),
      ...legs4(c1, 0.1, 0.22, -0.22, 0.14, 0.035),
      { geo: tube([[0, 0.2, -0.32], [0.04, 0.08, -0.6], [0.14, 0.03, -0.85], [0.3, 0.03, -0.95]], (t) => 0.03 * (1 - t * 0.7), 14, 5), colour: 0x8c7c70 },
    ],
    eyes: [
      [-0.06, 0.29, 0.5],
      [0.06, 0.29, 0.5],
    ],
    head: [0, 0.25, 0.45],
  }),
  armadillo: (c1, c2) => ({
    parts: [
      { geo: el(0.19, 0.19, 0.38, [0, 0.22, 0], 12, 8), colour: c1 },
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ geo: at(new THREE.TorusGeometry(0.19, 0.008, 4, 12, Math.PI), [0, 0.22, -0.16 + i * 0.04]), colour: c2 })),
      { geo: el(0.06, 0.06, 0.16, [0, 0.15, 0.48]), colour: c1 },
      ...[-1, 1].map((s) => ({ geo: el(0.03, 0.07, 0.02, [s * 0.05, 0.27, 0.42]), colour: c1 })),
      ...legs4(c1, 0.1, 0.22, -0.22, 0.1, 0.035),
      { geo: tube([[0, 0.16, -0.35], [0, 0.07, -0.6], [0, 0.03, -0.85]], (t) => 0.04 * (1 - t * 0.8), 8, 5), colour: c2 },
    ],
    eyes: [
      [-0.05, 0.19, 0.55],
      [0.05, 0.19, 0.55],
    ],
    head: [0, 0.16, 0.5],
  }),
  spider: (c1, c2) => ({
    unit: 1.7,
    parts: [
      { geo: el(0.17, 0.1, 0.2, [0, 0.2, 0.1]), colour: c1 },
      { geo: el(0.2, 0.15, 0.26, [0, 0.22, -0.28]), colour: c2 },
      ...[-1, 1].flatMap((s) =>
        [0.26, 0.12, -0.02, -0.16].flatMap((z, i) => {
          const fz = [0.75, 0.3, -0.25, -0.7][i]!;
          return [
            { geo: limb([s * 0.13, 0.2, z], [s * 0.48, 0.38, (z + fz) / 2], 0.03, 0.024, 4), colour: c1 },
            { geo: limb([s * 0.48, 0.38, (z + fz) / 2], [s * 0.82, 0, fz], 0.024, 0.012, 4), colour: c1 },
          ];
        }),
      ),
    ],
    eyes: [
      [-0.05, 0.25, 0.27],
      [0.05, 0.25, 0.27],
    ],
    head: [0, 0.2, 0.2],
  }),
  whipspider: (c1, c2) => ({
    unit: 2.0,
    parts: [
      { geo: el(0.17, 0.045, 0.14, [0, 0.07, 0.06]), colour: c1 },
      { geo: el(0.14, 0.05, 0.2, [0, 0.07, -0.2]), colour: c2 },
      ...[-1, 1].flatMap((s) => [
        // Spined grabbing arms, folded in front.
        { geo: limb([s * 0.06, 0.07, 0.16], [s * 0.2, 0.08, 0.36], 0.022, 0.018, 4), colour: c1 },
        { geo: limb([s * 0.2, 0.08, 0.36], [s * 0.03, 0.08, 0.44], 0.018, 0.008, 4), colour: c1 },
        // The whips: first legs turned into feelers many times the body length.
        { geo: limb([s * 0.1, 0.08, 0.1], [s * 0.7, 0.14, 0.5], 0.008, 0.006, 3), colour: c1 },
        { geo: limb([s * 0.7, 0.14, 0.5], [s * 1.0, 0.03, 0.95], 0.006, 0.003, 3), colour: c1 },
        ...[0.05, -0.05, -0.14].flatMap((z, i) => {
          const fz = [0.35, -0.1, -0.5][i]!;
          return [
            { geo: limb([s * 0.14, 0.07, z], [s * 0.5, 0.16, (z + fz) / 2], 0.016, 0.012, 4), colour: c1 },
            { geo: limb([s * 0.5, 0.16, (z + fz) / 2], [s * 0.85, 0, fz], 0.012, 0.006, 4), colour: c1 },
          ];
        }),
      ]),
    ],
    eyes: [],
    head: [0, 0.08, 0.1],
  }),
  ant: (c1, c2) => ({
    parts: [
      { geo: el(0.11, 0.1, 0.16, [0, 0.2, 0.36]), colour: c1 },
      { geo: el(0.08, 0.08, 0.17, [0, 0.2, 0.08]), colour: c1 },
      { geo: el(0.13, 0.12, 0.22, [0, 0.19, -0.3]), colour: c2 },
      ...[-1, 1].flatMap((s) => [
        ...[0.16, 0.06, -0.04].flatMap((z, i) => {
          const fz = [0.4, 0, -0.42][i]!;
          return [
            { geo: limb([s * 0.06, 0.2, z], [s * 0.26, 0.3, (z + fz) / 2], 0.018, 0.014, 4), colour: c1 },
            { geo: limb([s * 0.26, 0.3, (z + fz) / 2], [s * 0.42, 0, fz], 0.014, 0.008, 4), colour: c1 },
          ];
        }),
        { geo: limb([s * 0.05, 0.26, 0.46], [s * 0.2, 0.36, 0.66], 0.012, 0.008, 3), colour: c1 },
      ]),
    ],
    eyes: [],
    head: [0, 0.2, 0.35],
  }),
  // A marching column: built in metres, 44 workers, most carrying a cut piece of leaf.
  ants: (c1, c2) => {
    const parts: Part[] = [];
    for (let i = 0; i < 44; i++) {
      const z = -1.65 + i * 0.075;
      const x = Math.sin(i * 1.7) * 0.012;
      parts.push({ geo: el(0.0022, 0.002, 0.0045, [x, 0.004, z], 5, 4), colour: c1, flap: 2 });
      parts.push({ geo: el(0.002, 0.002, 0.0028, [x, 0.0045, z + 0.006], 5, 4), colour: c1, flap: 2 });
      if (i % 5 !== 3) {
        const g = new THREE.CircleGeometry(0.008 + (i % 3) * 0.002, 5);
        parts.push({ geo: at(g, [x, 0.014, z + 0.002], [0.3, 1.2 + (i % 4) * 0.3, 0.2]), colour: c2, flap: 2 });
      }
    }
    return { unit: -1, parts, eyes: [], head: [0, 0.02, 0] };
  },
  // Wings closed over the back, the way an owl butterfly rests: the "eye" shows.
  butterfly: (c1, c2) => ({
    parts: [
      { geo: el(0.03, 0.03, 0.2, [0, 0.05, 0]), colour: 0x2a2018 },
      ...[-1, 1].flatMap((s) => [
        { geo: at(new THREE.CircleGeometry(0.42, 9, -0.5, Math.PI * 0.95), [s * 0.012, 0.08, 0.05], [0, s * Math.PI * 0.5, 0], [1.05, 1, 1]), colour: c1 },
        { geo: at(new THREE.CircleGeometry(0.4, 9, Math.PI * 0.6, Math.PI * 0.9), [s * 0.012, 0.1, -0.02], [0, s * Math.PI * 0.5, 0], [1, 0.9, 1]), colour: c1 },
        { geo: at(new THREE.CircleGeometry(0.085, 12), [s * 0.02, 0.0, -0.17], [0, s * Math.PI * 0.5, 0]), colour: c2 },
        { geo: at(new THREE.CircleGeometry(0.05, 10), [s * 0.024, 0.0, -0.17], [0, s * Math.PI * 0.5, 0]), colour: 0x0c0a08 },
      ]),
    ],
    eyes: [],
    head: [0, 0.2, 0],
  }),
  beetle: (c1, c2) => ({
    parts: [
      { geo: el(0.15, 0.1, 0.34, [0, 0.12, -0.15]), colour: c1 },
      { geo: el(0.14, 0.09, 0.15, [0, 0.12, 0.28]), colour: c2 },
      { geo: el(0.07, 0.05, 0.06, [0, 0.11, 0.45]), colour: c1 },
    ],
    eyes: [],
    lights: [
      [-0.09, 0.19, 0.24],
      [0.09, 0.19, 0.24],
    ],
    head: [0, 0.12, 0.3],
  }),
  firefly: (c1, c2) => ({
    parts: [
      { geo: el(0.2, 0.12, 0.5, [0, 0, 0]), colour: c1 },
      { geo: el(0.16, 0.1, 0.14, [0, -0.02, -0.4]), colour: c2 },
    ],
    eyes: [],
    lights: [[0, -0.05, -0.45]],
    head: [0, 0, 0],
  }),
  // A cluster of small caps on rotting wood; built in metres.
  fungus: (c1, c2) => {
    const parts: Part[] = [];
    const lights: V[] = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.012 + (i % 4) * 0.014;
      const h = 0.018 + (i % 3) * 0.012;
      const x = Math.cos(a) * r * 2;
      const z = Math.sin(a) * r * 2;
      parts.push({ geo: at(rod(0.0018, 0.0014, h, 4), [x, 0, z]), colour: c2 });
      const cap = new THREE.SphereGeometry(0.008 + (i % 3) * 0.003, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      parts.push({ geo: at(cap, [x, h - 0.002, z]), colour: c1 });
      lights.push([x, h + 0.003, z]);
    }
    return { unit: -1, parts, eyes: [], lights, head: [0, 0.03, 0] };
  },
};

export function buildBody(sp: Species): Body {
  const made = plans[sp.body](sp.colours[0], sp.colours[1], sp);
  const geo = build(made.parts);
  // unit: the length the plan was drawn at; -1 means it is already in metres.
  const k = made.unit === -1 ? 1 : sp.size / (made.unit ?? 1);
  geo.scale(k, k, k);
  const s = (v: V): V => [v[0] * k, v[1] * k, v[2] * k];
  return { geo, eyes: made.eyes.map(s), lights: (made.lights ?? []).map(s), head: s(made.head) };
}
