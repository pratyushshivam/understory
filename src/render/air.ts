// What hangs in the air near you: small insects that only show when they cross the beam, and rain.

import * as THREE from 'three';
import { TORCH } from '../core/optics.ts';

export type Air = {
  group: THREE.Group;
  uniforms: {
    uTime: { value: number };
    uCam: { value: THREE.Vector3 };
    uTorchPos: { value: THREE.Vector3 };
    uTorchDir: { value: THREE.Vector3 };
    uTorch: { value: number };
    uRain: { value: number };
    uAmbient: { value: number };
    uCos: { value: THREE.Vector2 };
    uDpr: { value: number };
  };
};

export function buildAir(moteCount: number, rainCount: number): Air {
  const uniforms: Air['uniforms'] = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uTorchPos: { value: new THREE.Vector3() },
    uTorchDir: { value: new THREE.Vector3(0, 0, -1) },
    uTorch: { value: 1 },
    uRain: { value: 0 },
    uAmbient: { value: 0 },
    uCos: { value: new THREE.Vector2(Math.cos((TORCH.innerDeg * Math.PI) / 180), Math.cos((TORCH.outerDeg * Math.PI) / 180)) },
    uDpr: { value: 1 },
  };
  const group = new THREE.Group();
  const common = `
    uniform float uTime, uTorch, uRain, uAmbient, uDpr; uniform vec3 uCam, uTorchPos, uTorchDir; uniform vec2 uCos;
    float beamAt(vec3 w){ vec3 L = w - uTorchPos; float d = length(L); float c = dot(L / max(d, 1e-4), uTorchDir);
      return smoothstep(uCos.y, uCos.x, c) / (d * d + 0.5) * uTorch; }`;

  {
    const pos = new Float32Array(moteCount * 3);
    const seed = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i++) {
      pos[i * 3] = Math.random() * 14;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = Math.random() * 14;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `${common}
          attribute float aSeed; varying float vB;
          void main(){
            float t = uTime * (0.25 + aSeed * 0.6);
            vec3 p = position + vec3(sin(t * 1.3 + aSeed * 30.0), sin(t * 2.1 + aSeed * 11.0) * 0.6, cos(t * 1.1 + aSeed * 23.0)) * (0.5 + aSeed * 1.6);
            // Fast insects dart; rain grounds most of them.
            p.xz += vec2(sin(uTime * 3.0 * aSeed + aSeed * 99.0), cos(uTime * 2.7 * aSeed + aSeed * 71.0)) * step(0.82, aSeed) * 0.5;
            vec3 size = vec3(14.0, 6.0, 14.0);
            vec3 w = mod(p - uCam + size * 0.5, size) - size * 0.5 + uCam;
            w.y = mod(p.y, 6.0) + uCam.y - 1.7;
            vec4 mv = viewMatrix * vec4(w, 1.0);
            gl_Position = projectionMatrix * mv;
            vB = beamAt(w) * (1.0 - uRain * 0.8) * (0.5 + aSeed);
            gl_PointSize = vB < 0.004 ? 0.0 : clamp((1.2 + aSeed * 2.4) * uDpr * 5.0 / max(-mv.z, 0.3), 1.0, 9.0 * uDpr);
          }`,
        fragmentShader: `varying float vB; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * exp(-r * r * 3.0) * min(vB * 14.0, 3.0), 1.0); }`,
      }),
    );
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    group.add(pts);
  }

  {
    const pos = new Float32Array(rainCount * 6);
    const end = new Float32Array(rainCount * 2);
    const seed = new Float32Array(rainCount * 2);
    for (let i = 0; i < rainCount; i++) {
      const x = Math.random() * 16;
      const y = Math.random() * 12;
      const z = Math.random() * 16;
      const s = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      end.set([0, 1], i * 2);
      seed.set([s, s], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const lines = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `${common}
          attribute float aEnd, aSeed; varying float vB;
          void main(){
            vec3 size = vec3(16.0, 12.0, 16.0);
            vec3 p = position;
            p.y -= uTime * (7.5 + aSeed * 3.0);
            vec3 w = mod(p - uCam + size * 0.5, size) - size * 0.5 + uCam;
            w.y += aEnd * 0.28;
            w.x += aEnd * 0.012;
            vec4 mv = viewMatrix * vec4(w, 1.0);
            gl_Position = projectionMatrix * mv;
            // Only a share of the streaks show in light rain.
            float on = step(aSeed, uRain);
            vB = (beamAt(w) * 9.0 + uAmbient * 0.05) * on * (0.4 + 0.6 * aEnd);
          }`,
        fragmentShader: `varying float vB; void main(){ gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * min(vB, 1.6), 1.0); }`,
      }),
    );
    lines.frustumCulled = false;
    lines.renderOrder = 6;
    group.add(lines);
  }
  return { group, uniforms };
}
