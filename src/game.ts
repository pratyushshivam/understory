// The night itself: you, the torch, the clock, the weather, what you find and what finds you.

import * as THREE from 'three';
import { Sound } from './audio/sound.ts';
import { TORCH, eyeshineRange } from './core/optics.ts';
import { SPECIES, SPECIES_BY_ID } from './core/species.ts';
import { NIGHT_SECONDS, ambientLevel, hourAt, phaseAt, sunElevationDeg, type Phase } from './core/time.ts';
import type { Species } from './core/types.ts';
import { SITE, generateWorld, type World } from './core/world.ts';
import { buildAir, type Air } from './render/air.ts';
import { buildCreatures, type Creatures } from './render/creatures.ts';
import { buildForest, type Forest } from './render/forest.ts';
import { makePost, type Post } from './render/post.ts';

export type Quality = { plants: number; steps: number; maxDpr: number; motes: number; rain: number; lowPower: boolean };

export type GoalId = 'potoo' | 'dark' | 'river' | 'count';
export const GOALS: Record<GoalId, { text: string; done: string }> = {
  potoo: { text: 'Someone is whistling in the dark: slow notes, falling. Find the singer.', done: 'You found the singer.' },
  dark: { text: 'Switch off the torch and stand still. Let your eyes arrive.', done: 'The forest has its own light.' },
  river: { text: 'Walk east until the trees end. Reach the river.', done: 'The river.' },
  count: { text: 'Meet twelve of the forest’s animals before the sun does.', done: 'Twelve animals know you were here.' },
};
export const COUNT_GOAL = 12;

export type Hooks = {
  onFound(sp: Species, total: number): void;
  onHeard(sp: Species): void;
  onGoal(id: GoalId): void;
  onPhase(phase: Phase, hour: number): void;
  onWhisper(text: string): void;
  onFocus(progress: number): void;
  onEnd(): void;
};

const EYE_HEIGHT = 1.62;
const DEG = Math.PI / 180;

export class Game {
  readonly world: World;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 900);
  readonly sound: Sound;
  private forest: Forest;
  private creatures: Creatures;
  private air: Air;
  private post: Post;
  private spot: THREE.SpotLight;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  // You.
  pos = new THREE.Vector3(SITE.start.x, 0, SITE.start.z);
  yaw = 0; // facing -z: toward the river
  pitch = 0;
  private vel = new THREE.Vector2();
  private bob = 0;
  private stepIn = 0;
  move = { x: 0, y: 0, run: false };
  torchOn = true;
  private torchLevel = 1;
  private torchDir = new THREE.Vector3(0, 0, -1);
  private adapt = 0;
  private iris = 1;
  private darkFor = 0;

  // The night.
  time = 0;
  running = false;
  paused = false;
  autoQuality = true;
  timeScale = 1;
  private nextEvent = 0;
  private rain = 0;
  private rainFrom = -1;
  private rainTo = -1;
  private afterRain = 0;
  private hush = 0;
  private hushUntil = -1;
  private catAt = -1;
  private catLeave = -1;
  private catIndex = -1;
  private flash = 0;
  private wind = 0.2;
  private phase: Phase | null = null;
  private ended = false;

  found = new Set<string>();
  heard = new Set<string>();
  goals = new Set<GoalId>();
  private focus = -1;
  private focusFor = 0;
  private bigTrees: Array<{ x: number; z: number; r: number }> = [];
  private grid = new Map<number, Array<{ x: number; z: number; r: number }>>();
  private clock = new THREE.Clock();
  private frameMs = 16;
  private dpr = 1;
  private tmp = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private questCallIn = 4;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly seed: number,
    quality: Quality,
    private hooks: Hooks,
  ) {
    this.world = generateWorld(seed, SPECIES, {});
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    this.renderer.setPixelRatio(this.dpr);

    this.fog = new THREE.FogExp2(0x000000, 0.03);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x000000);

    this.forest = buildForest(this.world, { plants: quality.plants });
    this.scene.add(this.forest.group);
    this.creatures = buildCreatures(this.world, SPECIES);
    this.scene.add(this.creatures.group);
    this.air = buildAir(quality.motes, quality.rain);
    this.scene.add(this.air.group);

    this.hemi = new THREE.HemisphereLight(0x8fa8c8, 0x1a2418, 0.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd2a0, 0);
    this.scene.add(this.sun);

    this.spot = new THREE.SpotLight(0xfff0d8, 0, 70, TORCH.outerDeg * DEG, 1 - TORCH.innerDeg / TORCH.outerDeg, 2);
    this.camera.add(this.spot);
    this.camera.add(this.spot.target);
    this.spot.position.set(0.24, -0.26, 0.05);
    this.spot.target.position.set(0, 0, -10);
    this.scene.add(this.camera);

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post = makePost(Math.max(2, size.x), Math.max(2, size.y), quality.steps);
    this.sound = new Sound(this.world, SPECIES, this.creatures.head, quality.lowPower);
    this.sound.onHeard = (id) => {
      if (this.heard.has(id)) return;
      this.heard.add(id);
      this.hooks.onHeard(SPECIES_BY_ID.get(id)!);
    };

    for (const t of this.world.trees) {
      const o = { x: t.x, z: t.z, r: t.dbh / 2 + (t.kind === 'palm' ? 0.45 : t.buttress ? t.dbh * 0.6 : 0.12) };
      const k = this.cell(t.x, t.z);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k)!.push(o);
      if (t.dbh > 0.3) this.bigTrees.push({ x: t.x, z: t.z, r: t.dbh / 2 });
    }

    // The cat waits out of the world until its moment.
    const cat = this.world.animals.find((a) => a.species === 'jaguar');
    if (cat) {
      this.catIndex = cat.index;
      this.creatures.place(cat.index, 0, -80, 0, 0);
    }

    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z) + EYE_HEIGHT;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private cell(x: number, z: number): number {
    return Math.floor((x + 200) / 4) * 1000 + Math.floor((z + 200) / 4);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.resize(Math.max(2, size.x), Math.max(2, size.y));
    this.camera.aspect = w / h;
    // Keep the horizontal view wide enough on tall phone screens.
    this.camera.fov = w < h ? 82 : 68;
    this.camera.updateProjectionMatrix();
  }

  async begin(): Promise<void> {
    await this.sound.start();
    this.running = true;
    this.clock.getDelta();
  }

  toggleTorch(): void {
    this.torchOn = !this.torchOn;
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.max(-1.45, Math.min(1.5, this.pitch - dy));
  }

  private walk(dt: number): void {
    const speed = this.move.run ? 2.7 : 1.5;
    const len = Math.hypot(this.move.x, this.move.y);
    const mx = len > 1 ? this.move.x / len : this.move.x;
    const my = len > 1 ? this.move.y / len : this.move.y;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Forward is -z when yaw is 0.
    const tx = (mx * cos - my * sin) * speed;
    const tz = (-mx * sin - my * cos) * speed;
    const k = Math.min(1, dt * 7);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.y += (tz - this.vel.y) * k;
    let x = this.pos.x + this.vel.x * dt;
    let z = this.pos.z + this.vel.y * dt;
    // Trunks.
    const gx = Math.floor((x + 200) / 4);
    const gz = Math.floor((z + 200) / 4);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const list = this.grid.get((gx + i) * 1000 + gz + j);
        if (!list) continue;
        for (const t of list) {
          const dx = x - t.x;
          const dz = z - t.z;
          const d = Math.hypot(dx, dz);
          const min = t.r + 0.3;
          if (d < min && d > 1e-4) {
            x = t.x + (dx / d) * min;
            z = t.z + (dz / d) * min;
          }
        }
      }
    const edge = SITE.half - 4;
    x = Math.max(-edge, Math.min(edge, x));
    z = Math.max(SITE.riverZ + 1.5, Math.min(edge, z));
    const moved = Math.hypot(x - this.pos.x, z - this.pos.z);
    this.pos.x = x;
    this.pos.z = z;
    const pace = moved / Math.max(dt, 1e-4);
    this.bob += moved * 2.1;
    const ground = this.world.heightAt(x, z);
    const targetY = ground + EYE_HEIGHT + Math.sin(this.bob * 2) * 0.028 * Math.min(1, pace);
    this.pos.y += (targetY - this.pos.y) * Math.min(1, dt * 12);
    this.stepIn -= moved;
    if (this.stepIn < 0 && pace > 0.4) {
      this.stepIn = this.move.run ? 1.05 : 0.78;
      const wet = this.afterRain > 0.2 || this.rain > 0.2 || Math.abs(x - 46) < 0; // wet litter after rain
      this.sound.near(wet ? 'stepWet' : 'step', 0.05 + Math.random() * 0.03, 0.85 + Math.random() * 0.3);
    }
  }

  private runEvents(dt: number): void {
    const ev = this.world.events;
    while (this.nextEvent < ev.length && ev[this.nextEvent]!.at <= this.time) {
      const e = ev[this.nextEvent++]!;
      const behind = this.yaw + Math.PI + (Math.random() - 0.5) * 1.2;
      // "Behind" in world space: forward is (-sin yaw, -cos yaw).
      const bx = this.pos.x - Math.sin(behind) * 11;
      const bz = this.pos.z - Math.cos(behind) * 11;
      if (e.kind === 'rain') {
        this.rainFrom = e.at;
        this.rainTo = e.at + e.duration;
        this.hooks.onWhisper('Rain.');
      } else if (e.kind === 'thunder') {
        this.flash = 1;
        const a = Math.random() * 6.28;
        setTimeout(() => this.sound.oneShot('thunder', this.pos.x + Math.cos(a) * 60, 40, this.pos.z + Math.sin(a) * 60, 104), 900 + Math.random() * 1500);
      } else if (e.kind === 'crack') {
        this.sound.oneShot('crack', bx, this.pos.y - 0.5, bz, 84);
        this.hushUntil = Math.max(this.hushUntil, this.time + 4);
      } else if (e.kind === 'treefall') {
        const a = Math.random() * 6.28;
        this.sound.oneShot('treefall', this.pos.x + Math.cos(a) * 70, 8, this.pos.z + Math.sin(a) * 70, 108);
      } else if (e.kind === 'hush') {
        this.hushUntil = this.time + e.duration;
        this.catAt = this.time + 6;
      }
    }
    // Rain builds, holds and thins.
    let target = 0;
    if (this.time >= this.rainFrom && this.time < this.rainTo) {
      const into = this.time - this.rainFrom;
      const left = this.rainTo - this.time;
      target = Math.min(1, into / 9, left / 16);
      this.afterRain = 1;
    } else if (this.afterRain > 0) this.afterRain = Math.max(0, this.afterRain - dt / 90);
    this.rain += (target - this.rain) * Math.min(1, dt * 0.8);
    const nearRain = this.rainFrom > 0 && this.time > this.rainFrom - 35 && this.time < this.rainTo;
    this.wind += ((nearRain ? 1 : 0.2) - this.wind) * Math.min(1, dt * 0.2);
    this.hush += ((this.time < this.hushUntil ? 1 : 0) - this.hush) * Math.min(1, dt * (this.time < this.hushUntil ? 1.2 : 0.25));
    this.flash = Math.max(0, this.flash - dt * 5);

    // The reason the forest went quiet.
    if (this.catAt > 0 && this.time >= this.catAt && this.catIndex >= 0) {
      this.catAt = -1;
      const a = this.yaw + (Math.random() > 0.5 ? 0.42 : -0.42);
      const d = 15;
      const x = Math.max(-90, Math.min(90, this.pos.x - Math.sin(a) * d));
      const z = Math.max(SITE.riverZ + 6, Math.min(90, this.pos.z - Math.cos(a) * d));
      const heading = Math.atan2(this.pos.x - x, this.pos.z - z);
      this.creatures.place(this.catIndex, x, this.world.heightAt(x, z), z, heading);
      this.catLeave = this.time + 13;
    }
    if (this.catLeave > 0 && this.catIndex >= 0) {
      const seen = this.creatures.lit[this.catIndex]! > 0.6;
      if (seen && this.catLeave - this.time > 3.2) this.catLeave = this.time + 3.2;
      if (this.time >= this.catLeave) {
        const i3 = this.catIndex * 3;
        this.sound.oneShot('rustle', this.creatures.head[i3]!, this.creatures.head[i3 + 1]!, this.creatures.head[i3 + 2]!, 72);
        this.creatures.place(this.catIndex, 0, -80, 0, 0);
        this.catLeave = -1;
        this.hushUntil = this.time + 3;
      }
    }
  }

  private blocked(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    for (const t of this.bigTrees) {
      const u = ((t.x - ax) * dx + (t.z - az) * dz) / len2;
      if (u < 0.05 || u > 0.97) continue;
      const px = ax + dx * u - t.x;
      const pz = az + dz * u - t.z;
      if (px * px + pz * pz < t.r * t.r * 0.8) return true;
    }
    return false;
  }

  private identify(dt: number, ambient: number): void {
    const head = this.creatures.head;
    let best = -1;
    let bestScore = Infinity;
    for (const a of this.world.animals) {
      if (this.creatures.out[a.index]! < 0.3) continue;
      const sp = SPECIES_BY_ID.get(a.species)!;
      const i3 = a.index * 3;
      const dx = head[i3]! - this.pos.x;
      const dy = head[i3 + 1]! - this.pos.y;
      const dz = head[i3 + 2]! - this.pos.z;
      const d = Math.hypot(dx, dy, dz);
      let range = Math.min(40, 5 + sp.size * 45);
      const shines = sp.eye.reflectance > 0.2;
      if (shines) range = Math.max(range, Math.min(45, eyeshineRange(sp.eye, 0.004) * 0.75));
      const glows = !!sp.glow && this.adapt > 0.45;
      if (glows) range = sp.id === 'fireflies' ? 14 : 5;
      if (d > range) continue;
      const lux = this.creatures.lit[a.index]!;
      if (!glows && lux < 0.5 && ambient < 0.45) continue;
      const cosang = (dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z) / Math.max(d, 1e-4);
      const ang = Math.acos(Math.min(1, cosang));
      const tol = Math.max(2.4 * DEG, Math.atan((sp.size * 0.7) / d)) + (glows ? 7 : 1.6) * DEG;
      if (ang > tol) continue;
      const score = ang / tol + (this.found.has(sp.id) ? 2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = a.index;
      }
    }
    if (best >= 0) {
      const i3 = best * 3;
      if (this.blocked(this.pos.x, this.pos.z, head[i3]!, head[i3 + 2]!)) best = -1;
    }
    if (best >= 0 && this.found.has(this.world.animals[best]!.species)) best = -1;
    if (best !== this.focus) {
      this.focus = best;
      this.focusFor = 0;
    }
    if (best >= 0) {
      this.focusFor += dt;
      this.hooks.onFocus(Math.min(1, this.focusFor / 0.7));
      if (this.focusFor >= 0.7) {
        const sp = SPECIES_BY_ID.get(this.world.animals[best]!.species)!;
        this.found.add(sp.id);
        this.focus = -1;
        this.hooks.onFocus(0);
        this.hooks.onFound(sp, this.found.size);
        if (sp.id === 'common-potoo') this.finish('potoo');
        if (this.found.size >= COUNT_GOAL) this.finish('count');
      }
    } else this.hooks.onFocus(0);
  }

  private finish(id: GoalId): void {
    if (this.goals.has(id)) return;
    this.goals.add(id);
    this.hooks.onGoal(id);
  }

  private frame(): void {
    const raw = Math.min(this.clock.getDelta(), 0.1);
    this.frameMs += (raw * 1000 - this.frameMs) * 0.05;
    const dt = raw;
    const live = this.running && !this.paused;
    if (live && !this.ended) {
      this.time += dt * this.timeScale;
      if (this.time >= NIGHT_SECONDS) {
        this.time = NIGHT_SECONDS;
        this.ended = true;
        this.hooks.onEnd();
      }
    }
    const hour = hourAt(this.time);
    const elev = sunElevationDeg(hour);
    const ambient = ambientLevel(hour);
    const phase = phaseAt(hour);
    if (live && phase !== this.phase) {
      this.phase = phase;
      this.hooks.onPhase(phase, hour);
    }

    if (live) {
      this.walk(dt);
      this.runEvents(dt * this.timeScale);
    }

    // Camera.
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(this.fwd);

    // The torch lags a little behind your eyes, like a hand does.
    this.torchLevel += ((this.torchOn ? 1 : 0) - this.torchLevel) * Math.min(1, dt * 14);
    this.torchDir.lerp(this.fwd, Math.min(1, dt * 9)).normalize();
    const sway = Math.sin(this.bob * 2) * 0.012 * Math.min(1, this.vel.length());
    this.tmp.copy(this.torchDir).applyQuaternion(this.camera.quaternion.clone().invert());
    this.spot.target.position.set(this.tmp.x * 10 + sway * 10, this.tmp.y * 10 + Math.abs(sway) * 4, this.tmp.z * 10);
    const flicker = 1 - this.rain * 0.04 * Math.sin(this.time * 31);
    this.spot.intensity = 300 * this.torchLevel * flicker;
    const torchWorld = this.spot.getWorldPosition(new THREE.Vector3());

    // Eyes adapt to the dark slowly, and lose it at once.
    if (this.torchLevel < 0.1) {
      this.adapt = Math.min(1, this.adapt + dt / 9);
      if (live && ambient < 0.3 && this.vel.length() < 0.3) {
        this.darkFor += dt;
        if (this.darkFor > 14) this.finish('dark');
      }
    } else {
      this.adapt = Math.max(0, this.adapt - dt * 2.5);
      this.darkFor = 0;
    }
    if (this.pos.z < SITE.riverZ + 7) this.finish('river');

    // Light of the sky. `day` is 0 in full night and 1 once the sun is up.
    const day = THREE.MathUtils.smoothstep(elev, -13, 2);
    const evening = hour > 12;
    const sunDir = this.tmp.set(0.28, Math.sin(Math.max(elev, -20) * DEG), (evening ? 1 : -1) * Math.cos(elev * DEG)).normalize();
    const skyU = this.forest.sky.material.uniforms;
    skyU.uSun!.value.copy(sunDir);
    skyU.uDay!.value = Math.min(1, day + this.flash * 0.5);
    skyU.uCloud!.value = Math.max(this.rain, this.wind > 0.5 ? (this.wind - 0.5) * 2 : 0);
    this.forest.sky.position.copy(this.pos);

    const seeing = 1 + this.adapt * 5;
    const amb = 0.0016 * seeing + Math.pow(ambient, 2.2) * 1.5 + this.flash * 0.5;
    this.hemi.intensity = amb;
    this.hemi.color.setRGB(0.55 + 0.45 * day, 0.66 + 0.3 * day, 0.85 + 0.1 * day);
    this.sun.position.copy(sunDir).multiplyScalar(100);
    this.sun.target.position.set(0, 0, 0);
    const warm = THREE.MathUtils.smoothstep(elev, -3, 5);
    this.sun.intensity = warm * 1.4;
    const fogNight = 0.0009 * seeing;
    this.fog.color.setRGB(
      fogNight * 0.8 + ambient * ambient * (0.2 + 0.45 * warm) + this.flash * 0.05,
      fogNight + ambient * ambient * (0.26 + 0.3 * warm) + this.flash * 0.06,
      fogNight * 1.3 + ambient * ambient * (0.3 + 0.12 * warm) + this.flash * 0.09,
    );
    const mist = 0.35 + this.afterRain * 0.45 + THREE.MathUtils.smoothstep(hour > 12 ? 0 : hour, 3.5, 5.6) * 0.5;
    this.fog.density = 0.024 + mist * 0.012 - warm * 0.012;
    this.forest.water.material.emissive.setRGB(0.02 * day + 0.5 * warm * 0.35, 0.03 * day + 0.28 * warm * 0.35, 0.06 * day + 0.12 * warm * 0.3);

    this.forest.sway.uRain.value = this.rain;
    this.forest.update(this.time + this.clock.elapsedTime * 0.0);
    this.forest.sway.uTime.value = this.clock.elapsedTime;

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.creatures.update({
      dt,
      time: this.clock.elapsedTime,
      hour,
      cam: this.pos,
      torchPos: torchWorld,
      torchDir: this.torchDir,
      torch: this.torchLevel,
      adapt: this.adapt,
      viewportH: size.y,
      fovDeg: this.camera.fov,
    });

    const au = this.air.uniforms;
    au.uTime.value = this.clock.elapsedTime;
    au.uCam.value.copy(this.pos);
    au.uTorchPos.value.copy(torchWorld);
    au.uTorchDir.value.copy(this.torchDir);
    au.uTorch.value = this.torchLevel;
    au.uRain.value = this.rain;
    au.uAmbient.value = ambient + this.flash;
    au.uDpr.value = this.dpr;

    if (live) this.identify(dt, ambient);

    // The first goal needs its singer to sing.
    if (live && !this.goals.has('potoo') && this.world.questAnimal >= 0 && this.hush < 0.3 && this.rain < 0.3) {
      this.questCallIn -= dt;
      if (this.questCallIn < 0) {
        this.questCallIn = 11 + Math.random() * 5;
        this.sound.call(this.world.animals[this.world.questAnimal]!, this.soundState(dt, hour), true);
      }
    }
    if (live) this.sound.update(this.soundState(dt, hour));

    // Post.
    const pu = this.post.uniforms;
    pu.uTorch!.value = this.torchLevel;
    pu.uTime!.value = this.clock.elapsedTime;
    pu.uMist!.value = mist * (1 + this.rain * 0.6);
    // The eye (and any camera) stops down when the torch lands on something close.
    let hit = 30;
    for (let i = 1; i <= 20; i++) {
      const t = i * i * 0.075;
      const hx = torchWorld.x + this.torchDir.x * t;
      const hy = torchWorld.y + this.torchDir.y * t;
      const hz = torchWorld.z + this.torchDir.z * t;
      let stop = hy < this.world.heightAt(hx, hz) + 0.25;
      if (!stop) {
        const list = this.grid.get(this.cell(hx, hz));
        if (list) for (const tr of list) if (Math.hypot(hx - tr.x, hz - tr.z) < tr.r + 0.15) stop = true;
      }
      if (stop) {
        hit = t;
        break;
      }
    }
    const want = this.torchLevel > 0.5 ? Math.max(0.05, Math.min(1, (hit / 7) ** 2)) : 1;
    this.iris += (want - this.iris) * Math.min(1, dt * (want < this.iris ? 6 : 1.6));
    pu.uExposure!.value = (1 + this.adapt * 1.6 * (1 - ambient)) * (this.iris + (1 - this.iris) * ambient);
    (pu.uTorchPos!.value as THREE.Vector3).copy(torchWorld).applyMatrix4(this.camera.matrixWorldInverse);
    (pu.uTorchDir!.value as THREE.Vector3).copy(this.torchDir).transformDirection(this.camera.matrixWorldInverse);
    const sunScreen = new THREE.Vector3().copy(this.pos).addScaledVector(sunDir, 400).project(this.camera);
    const inFront = sunDir.dot(this.fwd) > 0.05;
    (pu.uSunUv!.value as THREE.Vector2).set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
    pu.uShafts!.value = inFront ? THREE.MathUtils.smoothstep(elev, -6, 3) * (evening ? 0.6 : 1) : 0;
    this.post.render(this.renderer, this.scene, this.camera);

    // Hold the frame rate: give up pixels before giving up smoothness.
    if (this.autoQuality && this.frameMs > 26 && this.dpr > 0.6 && document.hasFocus()) {
      this.dpr = Math.max(0.6, this.dpr - 0.1);
      this.frameMs = 16;
      this.resize();
    }
  }

  private soundState(dt: number, hour: number) {
    return {
      dt,
      time: this.time,
      hour,
      x: this.pos.x,
      y: this.pos.y,
      z: this.pos.z,
      fx: this.fwd.x,
      fy: this.fwd.y,
      fz: this.fwd.z,
      rain: this.rain,
      afterRain: this.afterRain,
      hush: this.hush,
      wind: this.wind,
    };
  }

  /** How far east the river is, and which way, for the compass whisper. */
  get hour(): number {
    return hourAt(this.time);
  }

  /** Debug and filming hooks. */
  debug = {
    setTime: (seconds: number) => {
      this.time = seconds;
      this.nextEvent = this.world.events.findIndex((e) => e.at > seconds);
      if (this.nextEvent < 0) this.nextEvent = this.world.events.length;
      this.ended = false;
    },
    teleport: (x: number, z: number, yaw?: number, pitch?: number) => {
      this.pos.set(x, this.world.heightAt(x, z) + EYE_HEIGHT, z);
      if (yaw !== undefined) this.yaw = yaw;
      if (pitch !== undefined) this.pitch = pitch;
    },
    nearest: (id: string) => {
      let best: { x: number; y: number; z: number; d: number } | null = null;
      for (const a of this.world.animals) {
        if (a.species !== id) continue;
        const d = Math.hypot(a.x - this.pos.x, a.z - this.pos.z);
        if (!best || d < best.d) best = { x: a.x, y: a.y, z: a.z, d };
      }
      return best;
    },
    lookAt: (x: number, y: number, z: number) => {
      const dx = x - this.pos.x;
      const dy = y - this.pos.y;
      const dz = z - this.pos.z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    },
    stats: () => ({ frameMs: this.frameMs, dpr: this.dpr, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, time: this.time, hour: this.hour }),
  };
}
