// Small geometry kit: every plant and animal is assembled from a few coloured primitives
// and merged into one mesh, so a whole species draws in a single call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Part = { geo: THREE.BufferGeometry; colour: number; flap?: number };

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();

export function at(
  geo: THREE.BufferGeometry,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1,
): THREE.BufferGeometry {
  const s = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale);
  q.setFromEuler(e.set(rot[0], rot[1], rot[2]));
  m.compose(new THREE.Vector3(...pos), q, s);
  return geo.clone().applyMatrix4(m);
}

export const ball = (r = 1, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const rod = (r0: number, r1: number, len: number, seg = 5) => {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  return g;
};

/** A limb from a to b. */
export function limb(a: [number, number, number], b: [number, number, number], r0: number, r1 = r0, seg = 5): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const g = rod(r0, r1, d.length(), seg);
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.compose(va, q, new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
}

/** A tube through points (for snakes, tails, lianas). */
export function tube(points: Array<[number, number, number]>, radius: (t: number) => number, seg = 24, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position!;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, c);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A leaf blade lying along +z from the origin, arching down, with a centre fold. */
export function leaf(length: number, width: number, droop: number, seg = 5, tip = 0.35): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = width * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75) * (1 - tip * 0.25)), 0.8) * (t > 0.98 ? 0.05 : 1);
    const a = t * droop;
    const z = (Math.sin(a) / Math.max(droop, 0.001)) * length;
    const y = ((1 - Math.cos(a)) / Math.max(droop, 0.001)) * -length + Math.sin(t * Math.PI) * length * 0.12;
    pos.push(-w / 2, y + w * 0.12, z, 0, y, z, w / 2, y + w * 0.12, z);
    uv.push(0, t, 0.5, t, 1, t);
    if (i < seg) {
      const k = i * 3;
      idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3, k + 1, k + 2, k + 4, k + 2, k + 5, k + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function paint(geo: THREE.BufferGeometry, colour: number, flap = 0, shade?: (y: number, i: number) => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position!.count;
  const col = new Float32Array(n * 3);
  const fl = new Float32Array(n);
  const c = new THREE.Color(colour);
  for (let i = 0; i < n; i++) {
    const k = shade ? shade(g.attributes.position!.getY(i), i) : 1;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
    fl[i] = flap;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aFlap', new THREE.BufferAttribute(fl, 1));
  return g;
}

export function build(parts: Part[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts.map((p) => paint(p.geo, p.colour, p.flap ?? 0)), false)!;
  parts.forEach((p) => p.geo.dispose());
  return merged;
}

export function buildShaded(parts: Array<Part & { shade?: (y: number, i: number) => number }>): THREE.BufferGeometry {
  return mergeGeometries(parts.map((p) => paint(p.geo, p.colour, p.flap ?? 0, p.shade)), false)!;
}
