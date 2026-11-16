// Builds the still parts of the night: ground, trunks, buttresses, stilt palms, crowns,
// understory plants, lianas, fallen logs, the river, the far bank and the sky.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SITE, streamX, type World } from '../core/world.ts';
import { makeRng } from '../core/rng.ts';
import { at, leaf, limb, rod } from './geo.ts';

export type Forest = {
  group: THREE.Group;
  sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  water: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>;
  /** Shared uniforms for leaf movement. */
  sway: { uTime: { value: number }; uRain: { value: number } };
  update(time: number): void;
};

const CHUNK = 50;

function canvasTexture(size: number, drawFn: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawFn(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function litterTexture(): THREE.CanvasTexture {
  const rng = makeRng(77);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#2a1d12';
    ctx.fillRect(0, 0, s, s);
    const tones = ['#4a321c', '#5c3d1f', '#3a2614', '#6b4a26', '#2f2415', '#7a5a2e', '#40351c', '#553018', '#33301a'];
    for (let i = 0; i < 1500; i++) {
      const x = rng() * s;
      const y = rng() * s;
      const l = 8 + rng() * 26;
      const w = l * (0.28 + rng() * 0.3);
      const a = rng() * Math.PI;
      // Draw each leaf nine times so the texture tiles without a seam.
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          ctx.save();
          ctx.translate(x + ox * s, y + oy * s);
          ctx.rotate(a);
          ctx.fillStyle = tones[i % tones.length]!;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.ellipse(0, 0, l, w, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#1a120a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-l, 0);
          ctx.lineTo(l, 0);
          ctx.stroke();
          ctx.restore();
        }
    }
  });
}

function barkTexture(): THREE.CanvasTexture {
  const rng = makeRng(31);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#6d6252';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 520; i++) {
      const x = rng() * s;
      const y = rng() * s;
      const h = 20 + rng() * 90;
      ctx.strokeStyle = rng() > 0.5 ? 'rgba(30,24,18,0.5)' : 'rgba(150,140,120,0.28)';
      ctx.lineWidth = 1 + rng() * 2.5;
      for (const oy of [-s, 0, s]) {
        ctx.beginPath();
        ctx.moveTo(x, y + oy);
        ctx.bezierCurveTo(x + rng() * 6 - 3, y + oy + h * 0.3, x + rng() * 6 - 3, y + oy + h * 0.6, x + rng() * 4 - 2, y + oy + h);
        ctx.stroke();
      }
    }
    // Lichen and moss blotches.
    for (let i = 0; i < 46; i++) {
      const x = rng() * s;
      const y = rng() * s;
      const r = 5 + rng() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rng() > 0.55 ? '120,150,110' : rng() > 0.5 ? '190,190,170' : '50,80,45';
      g.addColorStop(0, `rgba(${tone},0.55)`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function leafTexture(): THREE.CanvasTexture {
  const rng = makeRng(88);
  const t = canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#d6d6d6';
    ctx.fillRect(0, 0, s, s);
    // Side veins sweep from the midrib toward the tip (v runs along the leaf).
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const y = s - (i / 16) * s;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s / 2, y);
        ctx.quadraticCurveTo(s / 2 + dir * s * 0.3, y - s * 0.07, s / 2 + dir * s * 0.5, y - s * 0.16);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 16; i++) {
      const y = s - (i / 16) * s - s / 32;
      const g = ctx.createLinearGradient(0, y - 3, 0, y + 3);
      g.addColorStop(0, 'rgba(60,60,60,0)');
      g.addColorStop(0.5, 'rgba(60,60,60,0.28)');
      g.addColorStop(1, 'rgba(60,60,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 3, s, 6);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(s / 2 - 1.5, 0, 3, s);
    for (let i = 0; i < 26; i++) {
      // Blemishes: the bites and lichens every old rainforest leaf carries.
      const x = rng() * s;
      const y = rng() * s;
      const r = 2 + rng() * 7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(70,60,30,0.5)');
      g.addColorStop(1, 'rgba(70,60,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function rippleNormals(): THREE.CanvasTexture {
  const rng = makeRng(5);
  const t = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const x = rng() * s;
      const y = rng() * s;
      const w = 14 + rng() * 40;
      for (const ox of [-s, 0, s])
        for (const oy of [-s, 0, s]) {
          const g = ctx.createLinearGradient(0, y + oy - 3, 0, y + oy + 3);
          g.addColorStop(0, 'rgba(128,96,255,0)');
          g.addColorStop(0.35, 'rgba(128,84,255,0.5)');
          g.addColorStop(0.65, 'rgba(128,172,255,0.5)');
          g.addColorStop(1, 'rgba(128,160,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - w / 2, y + oy - 3, w, 6);
        }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function chunkKey(x: number, z: number): string {
  return `${Math.floor((x + 100) / CHUNK)}:${Math.floor((z + 100) / CHUNK)}`;
}

function byChunk<T extends { x: number; z: number }>(items: T[], filter: (t: T) => boolean = () => true): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    if (!filter(it)) continue;
    const k = chunkKey(it.x, it.z);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function addSway(mat: THREE.Material, sway: Forest['sway'], amount: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sway.uTime;
    shader.uniforms.uRain = sway.uRain;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uRain;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float swPhase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.53;
        #else
          float swPhase = position.x * 0.3 + position.z * 0.2;
        #endif
        float swH = max(position.y, 0.0) + length(position.xz) * 0.6;
        float sw = sin(uTime * 0.9 + swPhase + position.y * 1.3) * ${amount.toFixed(3)} * swH;
        // Rain makes every leaf tremble.
        float tr = sin(uTime * 23.0 + swPhase * 9.0 + position.x * 17.0 + position.z * 13.0) * 0.012 * uRain * swH;
        transformed.x += sw;
        transformed.z += sw * 0.6;
        transformed.y += tr;`,
      );
  };
}

function plantGeometries(): THREE.BufferGeometry[] {
  const col = (g: THREE.BufferGeometry, base: THREE.Color, tipLight = 0.25) => {
    const n = g.attributes.position!.count;
    const c = new Float32Array(n * 3);
    const uv = g.attributes.uv;
    for (let i = 0; i < n; i++) {
      const t = uv ? uv.getY(i) : 0.5;
      const mid = uv ? 1 - Math.abs(uv.getX(i) - 0.5) * 0.5 : 1;
      const k = (0.62 + t * tipLight) * mid;
      c[i * 3] = base.r * k;
      c[i * 3 + 1] = base.g * k;
      c[i * 3 + 2] = base.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const rng = makeRng(404);
  const out: THREE.BufferGeometry[] = [];
  // 0: broad-leaved shrub (aroids, young Rubiaceae): big blades arching from one point.
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng() * 0.5;
      const up = 0.5 + rng() * 0.6;
      const l = leaf(0.75 + rng() * 0.4, 0.3 + rng() * 0.12, 1.1 + rng() * 0.5);
      parts.push(col(at(l, [0, 0.25 + rng() * 0.5, 0], [-up, a, 0]), new THREE.Color(0x1f5224).offsetHSL(rng() * 0.04 - 0.02, 0, rng() * 0.06 - 0.03)));
    }
    out.push(mergeGeometries(parts)!);
  }
  // 1: ground fern or seedling palm: many narrow fronds.
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rng() * 0.4;
      const l = leaf(0.9 + rng() * 0.5, 0.12 + rng() * 0.05, 1.5 + rng() * 0.5, 6);
      parts.push(col(at(l, [0, 0.05, 0], [-(0.75 + rng() * 0.5), a, 0]), new THREE.Color(0x2a6226).offsetHSL(rng() * 0.05, 0, rng() * 0.05 - 0.03)));
    }
    out.push(mergeGeometries(parts)!);
  }
  // 2: sapling: a thin stem with leaves up its length.
  {
    const parts: THREE.BufferGeometry[] = [];
    const stem = rod(0.014, 0.006, 2.4, 4);
    stem.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(stem.attributes.position!.count * 2).fill(0.3), 2));
    parts.push(col(stem, new THREE.Color(0x3b3524), 0));
    for (let i = 0; i < 10; i++) {
      const y = 0.7 + (i / 10) * 1.7;
      const a = i * 2.4 + rng();
      const l = leaf(0.34 + rng() * 0.2, 0.13 + rng() * 0.05, 0.9 + rng() * 0.4, 4);
      parts.push(col(at(l, [0, y, 0], [-0.2 + rng() * 0.4, a, 0]), new THREE.Color(0x1e4f28).offsetHSL(rng() * 0.05, 0, rng() * 0.06 - 0.02)));
    }
    out.push(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!);
  }
  // 3: Heliconia by water: tall upright paddles.
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.6;
      const l = leaf(1.5 + rng() * 0.7, 0.42 + rng() * 0.12, 0.7 + rng() * 0.4, 6, 0.2);
      parts.push(col(at(l, [0, 0.1, 0], [-(1.15 + rng() * 0.25), a, 0]), new THREE.Color(0x245c2a).offsetHSL(rng() * 0.03, 0, rng() * 0.05)));
    }
    out.push(mergeGeometries(parts)!);
  }
  return out;
}

export function buildForest(world: World, quality: { plants: number }): Forest {
  const group = new THREE.Group();
  const sway: Forest['sway'] = { uTime: { value: 0 }, uRain: { value: 0 } };
  const rng = makeRng(world.seed ^ 0xbeef);
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();

  // ----- Ground -----
  {
    const x0 = -130;
    const x1 = 130;
    const z0 = -100;
    const z1 = 130;
    const nx = 130;
    const nz = 115;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position!;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, world.heightAt(x, z));
      const wet = Math.max(0, 1 - Math.abs(x - streamX(z)) / 3.5);
      const k = 1 - wet * 0.55;
      col[i * 3] = k;
      col[i * 3 + 1] = k;
      col[i * 3 + 2] = k * (1 - wet * 0.1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const tex = litterTexture();
    tex.repeat.set(1, 1);
    const uv = geo.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3.2, pos.getZ(i) / 3.2);
    const mat = new THREE.MeshPhongMaterial({ map: tex, vertexColors: true, shininess: 22, specular: 0x2a2a26 });
    const ground = new THREE.Mesh(geo, mat);
    ground.frustumCulled = false;
    group.add(ground);
  }

  // ----- Trunks -----
  const bark = barkTexture();
  const trunkProfile = [
    new THREE.Vector2(1.5, -0.02),
    new THREE.Vector2(1.12, 0.012),
    new THREE.Vector2(1.0, 0.035),
    new THREE.Vector2(0.92, 0.3),
    new THREE.Vector2(0.8, 0.62),
    new THREE.Vector2(0.62, 1.0),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkProfile, 9);
  {
    const uv = trunkGeo.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
  }
  const trunkMat = new THREE.MeshPhongMaterial({ map: bark, shininess: 8, specular: 0x1c1c18 });
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = crownGeo.attributes.position!;
    const r = makeRng(12);
    const seen = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.72 + r() * 0.5);
      const k = seen.get(key)!;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    crownGeo.computeVertexNormals();
  }
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x1d3a1c, flatShading: true });
  addSway(crownMat, sway, 0.004);

  const buttressGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2 + 0.3 * Math.sin(f * 5.1);
      const reach = 3.2 + 1.4 * Math.sin(f * 2.3);
      const pts: number[] = [];
      const idx: number[] = [];
      const seg = 5;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const y = 1 - t;
        const out = 0.85 + (reach - 0.85) * Math.pow(t, 2.2);
        pts.push(0.6, y, 0, out, y * 0.92 - 0.04, 0);
        if (i < seg) {
          const k = i * 2;
          idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const uvs: number[] = [];
      for (let i = 0; i < pts.length / 3; i++) uvs.push(pts[i * 3]! * 0.4, pts[i * 3 + 1]! * 1.5);
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.rotateY(a);
      g.computeVertexNormals();
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  })();
  const buttressMat = new THREE.MeshPhongMaterial({ map: bark, shininess: 8, specular: 0x1c1c18, side: THREE.DoubleSide });

  const stiltGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.2;
      const r = 0.75 + (i % 3) * 0.14;
      const g = limb([Math.cos(a) * r, -0.05, Math.sin(a) * r], [0, 1.05, 0], 0.045, 0.04, 4);
      g.deleteAttribute('uv');
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  })();
  const stiltMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  const frondGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      parts.push(at(leaf(4.2, 1.5, 1.7, 6, 0.1), [0, 0, 0], [-0.9 - (i % 3) * 0.15, a, 0]));
    }
    return mergeGeometries(parts)!;
  })();
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x1f4520, side: THREE.DoubleSide });

  const treeIndex = new Map(world.trees.map((t, i) => [t, i] as const));
  for (const [, list] of byChunk(world.trees)) {
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    const crowns: Array<{ x: number; y: number; z: number; r: number; flat: number }> = [];
    const butts = list.filter((t) => t.buttress);
    const palms = list.filter((t) => t.kind === 'palm');
    list.forEach((t, i) => {
      const y = world.heightAt(t.x, t.z);
      const palm = t.kind === 'palm';
      dummy.position.set(t.x, y - 0.25 + (palm ? 1.0 : 0), t.z);
      dummy.rotation.set(0, t.tint * 6.28, 0);
      const r = t.dbh / 2 / (palm ? 0.8 : 0.92);
      dummy.scale.set(r, t.height + 0.25 - (palm ? 1 : 0), r);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      if (palm) colour.setHSL(0.09, 0.08, 0.5 + t.tint * 0.12);
      else colour.setHSL(0.07 + t.tint * 0.05, 0.16 + t.tint * 0.12, 0.42 + ((treeIndex.get(t)! * 37) % 17) / 60);
      trunks.setColorAt(i, colour);
      if (!palm) {
        const n = t.dbh > 0.45 ? 4 : t.dbh > 0.2 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const a = rng.range(0, 6.28);
          const off = n === 1 ? 0 : t.crownRadius * 0.55;
          crowns.push({
            x: t.x + Math.cos(a) * off,
            z: t.z + Math.sin(a) * off,
            y: y + t.height - t.crownRadius * 0.25 + rng.range(-1.5, 1),
            r: t.crownRadius * (n === 1 ? 1 : 0.72) * rng.range(0.9, 1.15),
            flat: t.kind === 'emergent' ? 0.42 : 0.6,
          });
        }
      }
    });
    trunks.instanceMatrix.needsUpdate = true;
    group.add(trunks);

    const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, crowns.length);
    crowns.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(0, i * 1.7, 0);
      dummy.scale.set(c.r, c.r * c.flat, c.r);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);
      crownMesh.setColorAt(i, colour.setHSL(0.3 + rng.range(-0.04, 0.03), 0.4, rng.range(0.4, 0.62)));
    });
    group.add(crownMesh);

    if (butts.length) {
      const bm = new THREE.InstancedMesh(buttressGeo, buttressMat, butts.length);
      butts.forEach((t, i) => {
        dummy.position.set(t.x, world.heightAt(t.x, t.z) - 0.3, t.z);
        dummy.rotation.set(0, t.tint * 12, 0);
        const r = t.dbh / 2;
        dummy.scale.set(r, 1.6 + t.dbh * 2.4, r);
        dummy.updateMatrix();
        bm.setMatrixAt(i, dummy.matrix);
        bm.setColorAt(i, colour.setHSL(0.08 + t.tint * 0.04, 0.2, 0.5));
      });
      group.add(bm);
    }
    if (palms.length) {
      const sm = new THREE.InstancedMesh(stiltGeo, stiltMat, palms.length);
      const fm = new THREE.InstancedMesh(frondGeo, frondMat, palms.length);
      palms.forEach((t, i) => {
        const y = world.heightAt(t.x, t.z);
        dummy.position.set(t.x, y, t.z);
        dummy.rotation.set(0, t.tint * 9, 0);
        dummy.scale.set(0.8, 1.25, 0.8);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
        dummy.position.set(t.x, y + t.height, t.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fm.setMatrixAt(i, dummy.matrix);
      });
      group.add(sm, fm);
    }
  }

  // ----- Understory plants -----
  const plantGeos = plantGeometries();
  const leafMat = new THREE.MeshPhongMaterial({ map: leafTexture(), vertexColors: true, side: THREE.DoubleSide, shininess: 46, specular: 0x1c261c });
  addSway(leafMat, sway, 0.012);
  const plants = quality.plants >= 1 ? world.plants : world.plants.filter((_, i) => (i * 0.6180339) % 1 < quality.plants);
  for (let kind = 0; kind < plantGeos.length; kind++) {
    for (const [, list] of byChunk(plants, (p) => p.kind === kind)) {
      const mesh = new THREE.InstancedMesh(plantGeos[kind]!, leafMat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, world.heightAt(p.x, p.z) - 0.03, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.scale * (kind === 3 ? 1.1 : 1));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, colour.setHSL(0.28 + ((i * 13) % 10) / 160, 0.25, 0.72 + ((i * 7) % 10) / 40));
      });
      group.add(mesh);
    }
  }

  // ----- Lianas -----
  {
    const lianaMat = new THREE.MeshLambertMaterial({ color: 0x4b3b28 });
    addSway(lianaMat, sway, 0.0015);
    for (const [, list] of byChunk(world.lianas)) {
      const parts: THREE.BufferGeometry[] = [];
      for (const l of list) {
        const y0 = world.heightAt(l.x, l.z);
        const pts: THREE.Vector3[] = [];
        const loops = l.sway > 0.6 ? 1 : 0;
        for (let i = 0; i <= 7; i++) {
          const t = i / 7;
          const bow = Math.sin(t * Math.PI) * (0.5 + l.sway);
          pts.push(
            new THREE.Vector3(
              l.x + l.dx * t * 2 + bow * l.dz * 0.6 + (loops ? Math.sin(t * 9) * 0.25 : 0),
              y0 - 0.2 + t * l.top,
              l.z + l.dz * t * 2 - bow * l.dx * 0.6,
            ),
          );
        }
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.025 + l.sway * 0.03, 4, false);
        g.deleteAttribute('uv');
        parts.push(g);
      }
      if (parts.length) group.add(new THREE.Mesh(mergeGeometries(parts)!, lianaMat));
    }
  }

  // ----- Fallen logs -----
  {
    const logGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    logGeo.rotateZ(Math.PI / 2);
    const logMat = new THREE.MeshPhongMaterial({ map: bark, shininess: 12, specular: 0x222820 });
    const mesh = new THREE.InstancedMesh(logGeo, logMat, world.logs.length);
    world.logs.forEach((l, i) => {
      dummy.position.set(l.x, world.heightAt(l.x, l.z) + l.radius * 0.7, l.z);
      dummy.rotation.set(0, -l.rot, 0);
      dummy.scale.set(l.length, l.radius, l.radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colour.setHSL(0.22, 0.25, 0.3 + (i % 5) * 0.03));
    });
    group.add(mesh);
  }

  // ----- River and the far bank -----
  const ripples = rippleNormals();
  ripples.repeat.set(40, 8);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 80),
    new THREE.MeshPhongMaterial({ color: 0x0b0f0c, shininess: 140, specular: 0x8a8a80, normalMap: ripples, normalScale: new THREE.Vector2(0.35, 0.35) }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, SITE.waterY, SITE.riverZ - 32);
  group.add(water);
  {
    // Stream surface: a thin dark ribbon.
    const pts: number[] = [];
    const idx: number[] = [];
    let k = 0;
    for (let z = SITE.riverZ + 2; z <= SITE.half + 20; z += 2.5) {
      const x = streamX(z);
      const y = world.heightAt(x, z) + 0.16;
      pts.push(x - 1.3, y, z, x + 1.3, y, z);
      if (k > 0) idx.push(k * 2 - 2, k * 2, k * 2 - 1, k * 2 - 1, k * 2, k * 2 + 1);
      k++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x080b09, shininess: 160, specular: 0x777770 })));
  }
  {
    // Tree lines beyond the walkable patch: the far bank, and the forest that goes on.
    const wall = (ax: number, az: number, bx: number, bz: number, base: number, seed: number) => {
      const r = makeRng(seed);
      const pts: number[] = [];
      const idx: number[] = [];
      const n = 900;
      const crownsAlong = Array.from({ length: 150 }, () => ({ t: r(), w: 0.006 + r() * 0.014, h: 9 + r() * 12 + (r() > 0.9 ? 9 : 0) }));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        // Overlapping crowns: each a rounded hump of its own width and height.
        let h = 0;
        for (const c of crownsAlong) h = Math.max(h, c.h * Math.sqrt(Math.max(0, 1 - ((t - c.t) / c.w) ** 2)));
        h = 14 + h + r() * 0.8;
        pts.push(ax + (bx - ax) * t, base - 3, az + (bz - az) * t, ax + (bx - ax) * t, base + h, az + (bz - az) * t);
        if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex(idx);
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x050a06, side: THREE.DoubleSide }));
    };
    group.add(wall(-360, SITE.riverZ - 70, 360, SITE.riverZ - 70, SITE.waterY, 1));
    group.add(wall(-135, -74, -135, 140, 0, 2), wall(135, -74, 135, 140, 0, 3), wall(-135, 138, 135, 138, 0, 4));
  }

  // ----- Sky -----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSun: { value: new THREE.Vector3(0, -1, -1) },
        uDay: { value: 0 }, // 0 = night, 1 = sun on the horizon and above
        uCloud: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uSun; uniform float uDay; uniform float uCloud;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float up = clamp(d.y, 0.0, 1.0);
          vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z));
          float toward = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), sunFlat), 0.0);
          // Night: nearly black, a breath of blue.
          vec3 night = mix(vec3(0.004, 0.006, 0.010), vec3(0.0015, 0.002, 0.005), up);
          // Twilight: deep blue overhead, a band of rose and amber where the sun will be.
          vec3 twiZen = vec3(0.035, 0.075, 0.16);
          vec3 twiHor = mix(vec3(0.09, 0.13, 0.21), vec3(1.25, 0.5, 0.2), pow(toward, 2.5));
          vec3 twi = mix(twiHor, twiZen, pow(up, 0.7));
          // Day just after sunrise: pale gold low, soft blue high.
          vec3 dayHor = mix(vec3(0.55, 0.62, 0.70), vec3(2.2, 1.25, 0.6), pow(toward, 2.0));
          vec3 day = mix(dayHor, vec3(0.20, 0.36, 0.62), pow(up, 0.75));
          float a = smoothstep(0.0, 0.55, uDay);
          float b = smoothstep(0.5, 1.0, uDay);
          vec3 c = mix(mix(night, twi, a), day, b);
          // Stars, where the canopy lets you see them.
          vec3 sp = d * 150.0;
          vec3 g = floor(sp);
          float s = hash(g);
          vec3 f = fract(sp) - 0.5;
          float star = step(0.994, s) * smoothstep(0.32, 0.0, length(f)) * (0.3 + 0.7 * hash(g + 3.0));
          c += vec3(0.9, 0.95, 1.0) * star * 0.9 * (1.0 - a) * smoothstep(0.02, 0.25, d.y) * (1.0 - uCloud);
          float sunGlow = pow(max(dot(d, normalize(uSun)), 0.0), 48.0);
          c += vec3(1.6, 1.0, 0.5) * sunGlow * b * 1.5;
          c = mix(c, vec3(dot(c, vec3(0.33))) * 0.6, uCloud * 0.7);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  group.add(sky);

  return {
    group,
    sky,
    water,
    sway,
    update(time: number) {
      sway.uTime.value = time;
      ripples.offset.set(time * 0.004, time * 0.012);
    },
  };
}
