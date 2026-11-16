// Puts every animal of the night into the scene: bodies, the branches they sit on,
// their eyeshine (computed with the same tested function as the README describes)
// and the light of the things that glow by themselves.

import * as THREE from 'three';
import { strengthAt } from '../core/activity.ts';
import { angleOffAxis, eyeshine, torchLux } from '../core/optics.ts';
import type { Animal, Species } from '../core/types.ts';
import { SITE, type World } from '../core/world.ts';
import { buildBody, type Body } from './bodies.ts';

export type Frame = {
  dt: number;
  time: number;
  hour: number;
  cam: THREE.Vector3;
  torchPos: THREE.Vector3;
  torchDir: THREE.Vector3;
  torch: number; // 0..1
  adapt: number; // 0..1, how dark-adapted the eye is
  viewportH: number;
  fovDeg: number;
};

export type Creatures = {
  group: THREE.Group;
  /** World position of each animal's head, three numbers per animal. */
  head: Float32Array;
  /** 0..1: is this animal out right now. */
  out: Float32Array;
  /** Torch light on each animal in lux (0 when the torch is off). */
  lit: Float32Array;
  update(f: Frame): void;
  /** Moves one animal (used by the events). */
  place(index: number, x: number, y: number, z: number, heading: number): void;
};

const FLY_BODIES = new Set(['bat', 'macaw']);

export function buildCreatures(world: World, speciesList: readonly Species[]): Creatures {
  const group = new THREE.Group();
  const byId = new Map(speciesList.map((s) => [s.id, s] as const));
  const n = world.animals.length;
  const head = new Float32Array(n * 3);
  const out = new Float32Array(n);
  const lit = new Float32Array(n);
  const look = new Float32Array(n);
  const blink = new Float32Array(n);

  const uTime = { value: 0 };
  const bodyMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: 0x333330 });
  bodyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlap;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (aFlap > 0.5 && aFlap < 1.5) {
          float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
          transformed.y += sin(uTime * 22.0 + ph) * abs(position.x) * 0.75;
        } else if (aFlap > 1.5) {
          transformed.z += fract(uTime * 0.35) * 0.075;
        }`,
      );
  };
  const flatMat = bodyMat.clone();
  flatMat.side = THREE.DoubleSide;
  flatMat.onBeforeCompile = bodyMat.onBeforeCompile;

  const bodies = new Map<string, Body>();
  const meshes = new Map<string, THREE.InstancedMesh>();
  const slots = new Map<string, Animal[]>();
  for (const a of world.animals) {
    if (!slots.has(a.species)) slots.set(a.species, []);
    slots.get(a.species)!.push(a);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const matrices: THREE.Matrix4[] = world.animals.map(() => new THREE.Matrix4());

  const branchList: Array<{ a: THREE.Vector3; b: THREE.Vector3; r: number }> = [];

  function baseMatrix(a: Animal, sp: Species, target: THREE.Matrix4): void {
    if (a.perch === 'trunk') {
      Y.set(Math.cos(a.heading), 0, Math.sin(a.heading));
      Z.set(0, a.phase < 0.3 ? -1 : 1, 0);
      X.crossVectors(Y, Z);
      target.makeBasis(X, Y, Z);
      target.setPosition(a.x, a.y, a.z);
    } else {
      q.setFromAxisAngle(v.set(0, 1, 0), a.heading);
      let y = a.y;
      if (a.perch === 'water') y -= sp.size * 0.085;
      target.compose(v.set(a.x, y, a.z), q, one);
    }
  }

  for (const [id, list] of slots) {
    const sp = byId.get(id)!;
    const body = buildBody(sp);
    bodies.set(id, body);
    const mesh = new THREE.InstancedMesh(body.geo, sp.body === 'butterfly' || sp.body === 'ants' || sp.body === 'macaw' || sp.body === 'bat' ? flatMat : bodyMat, list.length);
    mesh.frustumCulled = list.length < 2 ? true : true;
    list.forEach((a, i) => {
      // Perched animals get a branch to sit on.
      if ((a.perch === 'understory' || a.perch === 'midstory' || a.perch === 'canopy') && a.tree >= 0) {
        const t = world.trees[a.tree]!;
        const r = Math.max(0.018, Math.min(0.09, sp.size * 0.09));
        const from = new THREE.Vector3(t.x, a.y - r - 0.25, t.z);
        const to = new THREE.Vector3(a.x, a.y - r, a.z);
        const dir = to.clone().sub(from).normalize();
        branchList.push({ a: from, b: to.clone().addScaledVector(dir, 0.5 + sp.size), r });
        // Face along or across the branch, as real perching animals do.
        if (sp.body === 'snake' || sp.body === 'kinkajou') a.heading = Math.atan2(dir.x, dir.z);
      }
      baseMatrix(a, sp, matrices[a.index]!);
      mesh.setMatrixAt(i, matrices[a.index]!);
      v.set(...body.head).applyMatrix4(matrices[a.index]!);
      head.set([v.x, v.y, v.z], a.index * 3);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.set(id, mesh);
    group.add(mesh);
  }

  // Branches.
  if (branchList.length) {
    const g = new THREE.CylinderGeometry(0.7, 1, 1, 5, 1);
    g.translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x4a3d2c }), branchList.length);
    branchList.forEach((b, i) => {
      const d = b.b.clone().sub(b.a);
      const len = d.length();
      q.setFromUnitVectors(v.set(0, 1, 0), d.normalize());
      m.compose(b.a, q, new THREE.Vector3(b.r, len, b.r));
      bm.setMatrixAt(i, m);
    });
    group.add(bm);
  }

  // ----- Eyeshine -----
  type EyeRef = { animal: number; local: [number, number, number]; sp: Species };
  const eyeRefs: EyeRef[] = [];
  for (const a of world.animals) {
    const sp = byId.get(a.species)!;
    if (sp.eye.reflectance <= 0) continue;
    for (const e of bodies.get(a.species)!.eyes) eyeRefs.push({ animal: a.index, local: e, sp });
  }
  const eyePos = new Float32Array(eyeRefs.length * 3);
  const eyeCol = new Float32Array(eyeRefs.length * 3);
  const eyeI = new Float32Array(eyeRefs.length);
  const eyeSize = new Float32Array(eyeRefs.length);
  const c = new THREE.Color();
  const setEyePos = (i: number) => {
    const e = eyeRefs[i]!;
    v.set(...e.local).applyMatrix4(matrices[e.animal]!);
    eyePos.set([v.x, v.y, v.z], i * 3);
  };
  eyeRefs.forEach((e, i) => {
    setEyePos(i);
    c.set(e.sp.eye.colour);
    eyeCol.set([c.r, c.g, c.b], i * 3);
    eyeSize[i] = e.sp.eye.pupilMm / 1000;
  });
  const eyeGeo = new THREE.BufferGeometry();
  eyeGeo.setAttribute('position', new THREE.BufferAttribute(eyePos, 3));
  eyeGeo.setAttribute('aColour', new THREE.BufferAttribute(eyeCol, 3));
  eyeGeo.setAttribute('aSize', new THREE.BufferAttribute(eyeSize, 1));
  const eyeIAttr = new THREE.BufferAttribute(eyeI, 1);
  eyeIAttr.setUsage(THREE.DynamicDrawUsage);
  eyeGeo.setAttribute('aI', eyeIAttr);
  const eyeUniforms = { uScale: { value: 800 }, uDpr: { value: 1 } };
  const eyes = new THREE.Points(
    eyeGeo,
    new THREE.ShaderMaterial({
      uniforms: eyeUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aI; attribute vec3 aColour; attribute float aSize;
        uniform float uScale; uniform float uDpr;
        varying vec3 vC; varying float vB;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z -= 0.0006 * gl_Position.w;
          float b = 1.0 - exp(-aI * 40.0);
          vB = b; vC = aColour;
          float px = uScale * aSize * 2.4 / max(-mv.z, 0.1);
          gl_PointSize = (b < 0.004) ? 0.0 : clamp(px + (2.5 + 9.0 * b) * uDpr, 0.0, 48.0 * uDpr);
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vB;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float r = length(p) * 2.0;
          float core = exp(-r * r * 9.0);
          float halo = exp(-r * r * 2.2) * 0.35;
          gl_FragColor = vec4((vC * (core * 5.0 + halo) + vec3(core * core) * 1.5) * vB, 1.0);
        }`,
    }),
  );
  eyes.frustumCulled = false;
  eyes.renderOrder = 5;
  group.add(eyes);

  // ----- Things that make their own light -----
  type GlowRef = { animal: number; sp: Species };
  const glowRefs: GlowRef[] = [];
  const gPos: number[] = [];
  const gCol: number[] = [];
  const gPhase: number[] = [];
  const gKind: number[] = [];
  const gStrength: number[] = [];
  for (const a of world.animals) {
    const sp = byId.get(a.species)!;
    if (!sp.glow) continue;
    const lights = bodies.get(a.species)!.lights;
    lights.forEach((l, k) => {
      v.set(...l).applyMatrix4(matrices[a.index]!);
      gPos.push(v.x, v.y, v.z);
      c.set(sp.glow!.colour);
      gCol.push(c.r, c.g, c.b);
      gPhase.push(a.phase + (sp.glow!.pattern === 'steady' ? k * 0.13 : 0));
      gKind.push(sp.glow!.pattern === 'steady' ? 0 : sp.glow!.pattern === 'flash' ? 1 : 2);
      gStrength.push(sp.glow!.strength);
      glowRefs.push({ animal: a.index, sp });
    });
  }
  const glowOn = new Float32Array(glowRefs.length);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
  glowGeo.setAttribute('aColour', new THREE.Float32BufferAttribute(gCol, 3));
  glowGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(gPhase, 1));
  glowGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(gKind, 1));
  glowGeo.setAttribute('aStrength', new THREE.Float32BufferAttribute(gStrength, 1));
  const glowOnAttr = new THREE.BufferAttribute(glowOn, 1);
  glowOnAttr.setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('aOn', glowOnAttr);
  const glowUniforms = { uTime, uAdapt: { value: 0 }, uScale: eyeUniforms.uScale, uDpr: eyeUniforms.uDpr };
  const glows = new THREE.Points(
    glowGeo,
    new THREE.ShaderMaterial({
      uniforms: glowUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 aColour; attribute float aPhase, aKind, aStrength, aOn;
        uniform float uTime, uAdapt, uScale, uDpr;
        varying vec3 vC; varying float vB;
        void main(){
          vec3 p = position;
          float f = 1.0;
          if (aKind > 0.5 && aKind < 1.5) {
            // A firefly drifts and flashes; each has its own rhythm.
            float t = uTime * (0.35 + aPhase * 0.3);
            p += vec3(sin(t + aPhase * 40.0) * 1.8, sin(t * 1.7 + aPhase * 17.0) * 0.5, cos(t * 0.8 + aPhase * 29.0) * 1.8);
            f = pow(max(sin(uTime * (1.6 + aPhase * 1.4) + aPhase * 50.0), 0.0), 10.0);
          } else if (aKind > 1.5) {
            f = 0.75 + 0.25 * sin(uTime * 2.0 + aPhase * 30.0);
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float seen = aKind < 0.5 ? uAdapt * uAdapt : 0.3 + 0.7 * uAdapt;
          vB = f * aStrength * aOn * seen;
          vC = aColour;
          float px = uScale * 0.012 / max(-mv.z, 0.1);
          gl_PointSize = vB < 0.01 ? 0.0 : clamp(px + (aKind < 0.5 ? 2.0 : 5.0) * uDpr, 0.0, 34.0 * uDpr);
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vB;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-r * r * 6.0) + exp(-r * r * 1.8) * 0.3;
          gl_FragColor = vec4(vC * a * vB * 2.2, 1.0);
        }`,
    }),
  );
  glows.frustumCulled = false;
  glows.renderOrder = 5;
  group.add(glows);

  // Who flies.
  const flyers = world.animals.filter((a) => FLY_BODIES.has(byId.get(a.species)!.body));
  const flyerSlot = new Map<number, number>();
  for (const [, list] of slots) list.forEach((a, i) => flyerSlot.set(a.index, i));

  let sinceCheck = 1;
  const speciesOut = new Map<string, number>();
  const toAnimal = { x: 0, y: 0, z: 0 };

  function refreshEyes(animal: number): void {
    for (let i = 0; i < eyeRefs.length; i++) if (eyeRefs[i]!.animal === animal) setEyePos(i);
    eyeGeo.attributes.position!.needsUpdate = true;
  }

  return {
    group,
    head,
    out,
    lit,
    place(index, x, y, z, heading) {
      const a = world.animals[index]!;
      a.x = x;
      a.y = y;
      a.z = z;
      a.heading = heading;
      const sp = byId.get(a.species)!;
      baseMatrix(a, sp, matrices[index]!);
      const mesh = meshes.get(a.species)!;
      mesh.setMatrixAt(flyerSlot.get(index)!, matrices[index]!);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      v.set(...bodies.get(a.species)!.head).applyMatrix4(matrices[index]!);
      head.set([v.x, v.y, v.z], index * 3);
      refreshEyes(index);
    },
    update(f) {
      uTime.value = f.time;
      eyeUniforms.uScale.value = f.viewportH / (2 * Math.tan((f.fovDeg * Math.PI) / 360));
      glowUniforms.uAdapt.value = f.adapt;

      sinceCheck += f.dt;
      if (sinceCheck > 0.4) {
        sinceCheck = 0;
        for (const [id, mesh] of meshes) {
          const level = strengthAt(byId.get(id)!.active, f.hour);
          speciesOut.set(id, level);
          mesh.visible = level > 0.08;
        }
        for (const a of world.animals) out[a.index] = speciesOut.get(a.species)!;
        for (let i = 0; i < glowRefs.length; i++) glowOn[i] = out[glowRefs[i]!.animal]!;
        glowOnAttr.needsUpdate = true;
      }

      // Flyers circle their patch.
      for (const a of flyers) {
        const sp = byId.get(a.species)!;
        const mesh = meshes.get(a.species)!;
        if (!mesh.visible) continue;
        let x: number;
        let y: number;
        let z: number;
        let hdg: number;
        if (sp.body === 'macaw') {
          const span = 420;
          const s = ((f.time * 11 + a.phase * span) % span) - span / 2;
          const dir = a.phase > 0.5 ? 1 : -1;
          x = s * dir;
          y = SITE.waterY + 22 + a.phase * 10 + Math.sin(f.time * 0.7 + a.phase * 9) * 0.6;
          z = SITE.riverZ - 22 - a.phase * 16 + Math.floor(a.phase * 7) * 0.9;
          hdg = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          const w = 0.9 + a.phase * 0.5;
          const R = 5 + a.phase * 6;
          const t = f.time * w + a.phase * 50;
          x = a.x + Math.cos(t) * R + Math.sin(t * 2.3) * 1.5;
          z = a.z + Math.sin(t) * R * 0.8;
          y = a.y + Math.sin(t * 1.7) * 0.8;
          hdg = Math.atan2(-Math.sin(t) * R, Math.cos(t) * R * 0.8);
        }
        q.setFromAxisAngle(v.set(0, 1, 0), hdg);
        m.compose(v.set(x, y, z), q, one);
        mesh.setMatrixAt(flyerSlot.get(a.index)!, m);
        mesh.instanceMatrix.needsUpdate = true;
        head.set([x, y, z], a.index * 3);
      }

      // Light on each animal, and its eyeshine.
      for (const a of world.animals) {
        const i3 = a.index * 3;
        toAnimal.x = head[i3]!;
        toAnimal.y = head[i3 + 1]!;
        toAnimal.z = head[i3 + 2]!;
        const d = Math.hypot(toAnimal.x - f.torchPos.x, toAnimal.y - f.torchPos.y, toAnimal.z - f.torchPos.z);
        if (d > 90 || f.torch < 0.01) {
          lit[a.index] = 0;
          look[a.index] = Math.max(0, look[a.index]! - f.dt);
          continue;
        }
        const ang = angleOffAxis(f.torchPos, f.torchDir, toAnimal);
        const lux = torchLux(d, ang) * f.torch;
        lit[a.index] = lux;
        // An animal caught in the beam turns to look at the light. Now and then it blinks or looks away.
        const target = lux > 0.15 ? 1 : 0.35;
        look[a.index] = look[a.index]! + (target - look[a.index]!) * Math.min(1, f.dt * 2.2);
        if (blink[a.index]! > 0) blink[a.index] = blink[a.index]! - f.dt;
        else if (Math.random() < f.dt * 0.12) blink[a.index] = 0.12 + Math.random() * 0.5;
      }
      for (let i = 0; i < eyeRefs.length; i++) {
        const e = eyeRefs[i]!;
        const k = e.animal;
        if (lit[k]! <= 0 || out[k]! < 0.08 || blink[k]! > 0) {
          eyeI[i] = 0;
          continue;
        }
        toAnimal.x = eyePos[i * 3]!;
        toAnimal.y = eyePos[i * 3 + 1]!;
        toAnimal.z = eyePos[i * 3 + 2]!;
        const d = Math.hypot(toAnimal.x - f.torchPos.x, toAnimal.y - f.torchPos.y, toAnimal.z - f.torchPos.z);
        const ang = angleOffAxis(f.torchPos, f.torchDir, toAnimal);
        let I = eyeshine(e.sp.eye, d, ang, 0.3 + 0.7 * look[k]!) * f.torch;
        // Spider eyes are tiny mirrors: they glitter as you move.
        if (e.sp.body === 'spider') I *= 0.55 + 0.9 * Math.abs(Math.sin(f.cam.x * 9 + f.cam.z * 7 + k));
        eyeI[i] = I;
      }
      eyeIAttr.needsUpdate = true;
    },
  };
}
