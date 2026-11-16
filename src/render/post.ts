// One full-screen pass after the scene: the torch beam scattering in the mist,
// shafts of dawn light, tone mapping, vignette and a little grain.

import * as THREE from 'three';
import { TORCH } from '../core/optics.ts';

export type Post = {
  target: THREE.WebGLRenderTarget;
  uniforms: Record<string, THREE.IUniform>;
  resize(w: number, h: number): void;
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
};

export function makePost(width: number, height: number, steps: number): Post {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(width, height),
    samples: 0,
  });
  const uniforms: Record<string, THREE.IUniform> = {
    tColor: { value: target.texture },
    tDepth: { value: target.depthTexture },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uNear: { value: 0.1 },
    uFar: { value: 600 },
    uTorchPos: { value: new THREE.Vector3() }, // view space
    uTorchDir: { value: new THREE.Vector3(0, 0, -1) }, // view space
    uTorch: { value: 1 },
    uMist: { value: 0.5 },
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uSunUv: { value: new THREE.Vector2(0.5, 0.6) },
    uShafts: { value: 0 },
    uShaftColour: { value: new THREE.Color(1.0, 0.72, 0.4) },
    uFade: { value: 0 },
    uCos: { value: new THREE.Vector2(Math.cos((TORCH.innerDeg * Math.PI) / 180), Math.cos((TORCH.outerDeg * Math.PI) / 180)) },
    uAspect: { value: width / height },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tColor; uniform sampler2D tDepth;
      uniform mat4 uInvProj; uniform mat4 uCamWorld;
      uniform float uNear, uFar, uTorch, uMist, uTime, uExposure, uShafts, uFade, uAspect;
      uniform vec3 uTorchPos, uTorchDir, uShaftColour; uniform vec2 uSunUv, uCos;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        float depth = texture2D(tDepth, vUv).x;
        vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        vec4 view = uInvProj * clip; view /= view.w;
        float dist = length(view.xyz);
        vec3 ray = view.xyz / max(dist, 1e-4);
        // Interleaved gradient noise: a dither that the eye reads as smooth.
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy + fract(uTime * 7.0) * 37.0, vec2(0.06711056, 0.00583715))));

        // Torch light scattered by mist along the line of sight.
        if (uTorch > 0.001) {
          float reach = min(dist, 26.0);
          const int N = ${steps};
          float sum = 0.0;
          float prev = 0.0;
          for (int i = 0; i < N; i++) {
            // Steps bunch up near you, where the beam changes fastest.
            float u = (float(i) + 0.5 + (jitter - 0.5) * 0.9) / float(N);
            float t = reach * u * u;
            float dt = t - prev; prev = t;
            vec3 p = ray * t;
            vec3 L = p - uTorchPos;
            float d = length(L);
            float c = dot(L / max(d, 1e-4), uTorchDir);
            float beam = smoothstep(uCos.y, uCos.x, c);
            vec3 w = (uCamWorld * vec4(p, 1.0)).xyz;
            float n = noise(w * 0.55 + vec3(uTime * 0.12, -uTime * 0.05, uTime * 0.08));
            float wisps = 0.35 + 1.3 * n * n;
            sum += beam * wisps / (d * d + 2.0) * dt;
          }
          col += vec3(1.0, 0.93, 0.80) * sum * uMist * uTorch * 0.42;
        }

        // Dawn: light pouring through the gaps in the canopy toward you.
        if (uShafts > 0.001) {
          vec2 delta = (uSunUv - vUv);
          float len = length(delta * vec2(uAspect, 1.0));
          vec2 stepUv = delta / 30.0;
          vec2 uv = vUv + stepUv * jitter;
          float acc = 0.0; float w = 1.0;
          for (int i = 0; i < 30; i++) {
            if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
              float dz = texture2D(tDepth, uv).x;
              vec3 sc = texture2D(tColor, uv).rgb;
              acc += step(0.99999, dz) * min(dot(sc, vec3(0.3333)), 1.5) * w;
            }
            w *= 0.965; uv += stepUv;
          }
          col += uShaftColour * acc * uShafts * 0.06 * smoothstep(1.6, 0.0, len);
        }

        col *= uExposure;
        col = aces(col);
        col = pow(col, vec3(1.0 / 2.2));
        vec2 q = vUv - 0.5;
        col *= 1.0 - dot(q, q) * 0.9;
        col += (hash(vec3(gl_FragCoord.xy, uTime)) - 0.5) * 0.018;
        col *= 1.0 - uFade;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    target,
    uniforms,
    resize(w, h) {
      target.setSize(w, h);
      uniforms.uAspect!.value = w / h;
    },
    render(renderer, scene, camera) {
      uniforms.uInvProj!.value.copy(camera.projectionMatrixInverse);
      uniforms.uCamWorld!.value.copy(camera.matrixWorld);
      uniforms.uNear!.value = camera.near;
      uniforms.uFar!.value = camera.far;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
