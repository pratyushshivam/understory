// The forest you hear. Every animal voice comes from a placed animal, through an HRTF panner,
// at a loudness worked out from distance and the forest's absorption (core/acoustics.ts).

import { strengthAt } from '../core/activity.ts';
import { AUDIBLE_DB, levelAt, lowpassHzFor } from '../core/acoustics.ts';
import type { Animal, Species } from '../core/types.ts';
import { SITE, streamX, type World } from '../core/world.ts';
import { parseRecipe, renderRecipe, renderWorldSounds, type Made } from './synth.ts';

export type SoundState = {
  dt: number;
  time: number;
  hour: number;
  x: number;
  y: number;
  z: number;
  fx: number;
  fy: number;
  fz: number;
  rain: number;
  /** 0..1: how recently it rained (frogs love it, leaves drip). */
  afterRain: number;
  /** 0..1: everything alive holds its breath. */
  hush: number;
  wind: number;
};

type Voice = { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; pan: PannerNode; animal: number; until: number; db1m: number; freq: number };
type Looper = { src: AudioBufferSourceNode; gain: GainNode; pan: PannerNode; animal: number };

const MAX_VOICES = 10;
const MAX_LOOPERS = 6;
/** dB level that plays at full scale. */
const REF_DB = 74;

export class Sound {
  ctx!: AudioContext;
  private master!: GainNode;
  private life!: GainNode; // all animal voices: ducked by the hush
  private made!: Made;
  private buffers = new Map<string, AudioBuffer>();
  private worldBuf = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];
  private loopers: Looper[] = [];
  private nextAt: Float32Array;
  private callers: Animal[] = [];
  private continuous: Animal[] = [];
  private byId: Map<string, Species>;
  private beds: Record<string, { gain: GainNode; pan?: PannerNode }> = {};
  private sinceLoopCheck = 9;
  private dripIn = 1;
  private lowPower: boolean;
  ready = false;
  loaded = 0;
  total = 0;
  onHeard: (speciesId: string, animal: number) => void = () => {};

  constructor(
    private world: World,
    speciesList: readonly Species[],
    private head: Float32Array,
    lowPower: boolean,
  ) {
    this.byId = new Map(speciesList.map((s) => [s.id, s] as const));
    this.lowPower = lowPower;
    this.nextAt = new Float32Array(world.animals.length);
    for (const a of world.animals) {
      const sp = this.byId.get(a.species)!;
      if (sp.calling.length === 0 || sp.voice.kind === 'silent') continue;
      if (sp.callEvery[1] === 0) this.continuous.push(a);
      else {
        this.callers.push(a);
        this.nextAt[a.index] = a.phase * sp.callEvery[1] * 1.5;
      }
    }
  }

  /** Must be called from a tap or key press. */
  async start(): Promise<void> {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    await ctx.resume();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
    this.life = ctx.createGain();
    this.life.connect(this.master);

    this.made = renderWorldSounds(ctx.sampleRate);
    for (const [name, data] of Object.entries(this.made)) this.worldBuf.set(name, this.toBuffer(data));

    // Synthesised voices are rendered now; recordings are fetched in the background.
    for (const sp of this.byId.values()) {
      if (sp.voice.kind === 'synth') this.buffers.set(sp.id, this.toBuffer(renderRecipe(parseRecipe(sp.voice.recipe), ctx.sampleRate)));
    }
    const files = [...this.byId.values()].filter((s) => s.voice.kind === 'recording');
    this.total = files.length;
    void Promise.all(
      files.map(async (sp) => {
        try {
          const res = await fetch(`./audio/${(sp.voice as { file: string }).file}`);
          if (!res.ok) throw new Error(String(res.status));
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(sp.id, buf);
        } catch {
          // A missing file leaves that animal silent; nothing else stands in for it.
        }
        this.loaded++;
      }),
    );

    const bed = (name: string, buffer: string, spatial: boolean, lowpass?: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.worldBuf.get(buffer)!;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      let node: AudioNode = src;
      if (lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        node = node.connect(f);
      }
      node = node.connect(gain);
      let pan: PannerNode | undefined;
      if (spatial) {
        pan = this.panner();
        node.connect(pan).connect(this.master);
      } else node.connect(this.master);
      src.start(0, Math.random() * 2);
      this.beds[name] = { gain, pan };
    };
    bed('rain', 'rain', false);
    bed('wind', 'wind', false);
    bed('river', 'river', true);
    bed('stream', 'stream', true);
    bed('far', 'farChorus', false, 7000);
    this.life.gain.value = 1;
    this.ready = true;
  }

  private toBuffer(data: Float32Array): AudioBuffer {
    const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }

  private panner(): PannerNode {
    const p = this.ctx.createPanner();
    p.panningModel = this.lowPower ? 'equalpower' : 'HRTF';
    p.distanceModel = 'inverse';
    p.rolloffFactor = 0; // distance loss is applied by us, from core/acoustics.ts
    return p;
  }

  private setPos(p: PannerNode, x: number, y: number, z: number): void {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else p.setPosition(x, y, z);
  }

  private gainFromDb(db: number): number {
    return Math.min(1.2, Math.pow(10, (db - REF_DB) / 20));
  }

  /** Plays one call of this animal now, if it can be heard from where you stand. */
  call(animal: Animal, s: SoundState, force = false): boolean {
    const sp = this.byId.get(animal.species)!;
    const buf = this.buffers.get(sp.id);
    if (!buf) return false;
    const i3 = animal.index * 3;
    const d = Math.hypot(this.head[i3]! - s.x, this.head[i3 + 1]! - s.y, this.head[i3 + 2]! - s.z);
    const db = levelAt(sp.loudness[0], d, sp.loudness[1]);
    if (db < AUDIBLE_DB) return false;
    if (this.voices.some((v) => v.animal === animal.index)) return false;
    if (this.voices.length >= MAX_VOICES && !force) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpassHzFor(d);
    const gain = ctx.createGain();
    const g = this.gainFromDb(db);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(g, ctx.currentTime + 0.04);
    const pan = this.panner();
    this.setPos(pan, this.head[i3]!, this.head[i3 + 1]!, this.head[i3 + 2]!);
    src.connect(filter).connect(gain).connect(pan).connect(this.life);
    src.start();
    const voice: Voice = { src, gain, filter, pan, animal: animal.index, until: s.time + buf.duration, db1m: sp.loudness[0], freq: sp.loudness[1] };
    this.voices.push(voice);
    src.onended = () => {
      this.voices = this.voices.filter((v) => v !== voice);
      pan.disconnect();
    };
    if (db > 26) this.onHeard(sp.id, animal.index);
    return true;
  }

  /** A sound of the world (not an animal) at a place. */
  oneShot(name: keyof Made, x: number, y: number, z: number, db: number, rate = 1): void {
    if (!this.ready) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.worldBuf.get(name)!;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = this.gainFromDb(db);
    const pan = this.panner();
    this.setPos(pan, x, y, z);
    src.connect(gain).connect(pan).connect(this.master);
    src.start();
    src.onended = () => pan.disconnect();
  }

  /** Close sounds that belong to you: footsteps. */
  near(name: keyof Made, gain: number, rate = 1): void {
    if (!this.ready) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.worldBuf.get(name)!;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
  }

  update(s: SoundState): void {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.value = s.x;
      L.positionY.value = s.y;
      L.positionZ.value = s.z;
      L.forwardX.value = s.fx;
      L.forwardY.value = s.fy;
      L.forwardZ.value = s.fz;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(s.x, s.y, s.z);
      L.setOrientation(s.fx, s.fy, s.fz, 0, 1, 0);
    }

    const quiet = 1 - s.hush;
    this.life.gain.setTargetAtTime(quiet, now, 0.5);

    // Beds.
    this.beds.rain!.gain.gain.setTargetAtTime(s.rain * s.rain * 0.5, now, 0.4);
    this.beds.wind!.gain.gain.setTargetAtTime(0.02 + s.wind * 0.16, now, 1.5);
    const rx = Math.max(-SITE.half, Math.min(SITE.half, s.x));
    const rz = SITE.riverZ - 14;
    const dRiver = Math.hypot(s.x - rx, s.z - rz);
    this.setPos(this.beds.river!.pan!, rx, SITE.waterY, rz);
    this.beds.river!.gain.gain.setTargetAtTime(this.gainFromDb(levelAt(86, dRiver, 400)) * 0.8, now, 0.3);
    const sx = streamX(s.z);
    const dStream = Math.max(1, Math.abs(s.x - sx));
    this.setPos(this.beds.stream!.pan!, sx, this.world.heightAt(sx, s.z), s.z);
    this.beds.stream!.gain.gain.setTargetAtTime(this.gainFromDb(levelAt(62, dStream, 2500)), now, 0.3);

    // Continuous singers (crickets, katydids, cicadas): the nearest few get a voice each.
    this.sinceLoopCheck += s.dt;
    let chorus = 0;
    if (this.sinceLoopCheck > 1.2) {
      this.sinceLoopCheck = 0;
      const scored: Array<{ a: Animal; db: number }> = [];
      for (const a of this.continuous) {
        const sp = this.byId.get(a.species)!;
        const strength = strengthAt(sp.calling, s.hour) * (1 - s.rain * 0.6);
        chorus = Math.max(chorus, strength);
        if (strength < 0.1 || !this.buffers.has(sp.id)) continue;
        const i3 = a.index * 3;
        const d = Math.hypot(this.head[i3]! - s.x, this.head[i3 + 1]! - s.y, this.head[i3 + 2]! - s.z);
        const db = levelAt(sp.loudness[0], d, sp.loudness[1]) + 20 * Math.log10(Math.max(strength, 0.05));
        if (db > AUDIBLE_DB) scored.push({ a, db });
      }
      scored.sort((p, q) => q.db - p.db);
      const keep = scored.slice(0, MAX_LOOPERS);
      for (const l of [...this.loopers]) {
        if (!keep.some((k) => k.a.index === l.animal)) {
          l.gain.gain.setTargetAtTime(0, now, 0.4);
          l.src.stop(now + 2);
          this.loopers = this.loopers.filter((x) => x !== l);
        }
      }
      for (const k of keep) {
        let l = this.loopers.find((x) => x.animal === k.a.index);
        if (!l) {
          const src = ctx.createBufferSource();
          src.buffer = this.buffers.get(k.a.species)!;
          src.loop = true;
          // No two insects sing at quite the same pitch or tempo.
          src.playbackRate.value = 0.94 + k.a.phase * 0.12;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          const pan = this.panner();
          const i3 = k.a.index * 3;
          this.setPos(pan, this.head[i3]!, this.head[i3 + 1]!, this.head[i3 + 2]!);
          src.connect(gain).connect(pan).connect(this.life);
          src.start(0, k.a.phase * src.buffer.duration);
          src.onended = () => pan.disconnect();
          l = { src, gain, pan, animal: k.a.index };
          this.loopers.push(l);
          if (k.db > 30) this.onHeard(k.a.species, k.a.index);
        }
        l.gain.gain.setTargetAtTime(this.gainFromDb(k.db) * 0.8, now, 0.6);
      }
      this.beds.far!.gain.gain.setTargetAtTime(0.012 + chorus * 0.05 * (1 - s.rain * 0.5), now, 2);
    }

    // Callers.
    for (const a of this.callers) {
      if (s.time < this.nextAt[a.index]!) continue;
      const sp = this.byId.get(a.species)!;
      let strength = strengthAt(sp.calling, s.hour);
      if (sp.group === 'frog') strength = Math.min(1, strength * (1 + 0.8 * s.afterRain)) * (1 - s.rain * 0.3);
      else strength *= 1 - s.rain * 0.9;
      if (strength < 0.04) {
        this.nextAt[a.index] = s.time + 2 + Math.random() * 2;
        continue;
      }
      const wait = (sp.callEvery[0] + Math.random() * (sp.callEvery[1] - sp.callEvery[0])) / Math.max(strength, 0.25);
      this.nextAt[a.index] = s.time + wait;
      if (s.hush > 0.5) continue;
      this.call(a, s);
    }

    // Voices in flight follow the listener's movement.
    for (const v of this.voices) {
      const i3 = v.animal * 3;
      const d = Math.hypot(this.head[i3]! - s.x, this.head[i3 + 1]! - s.y, this.head[i3 + 2]! - s.z);
      v.gain.gain.setTargetAtTime(this.gainFromDb(levelAt(v.db1m, d, v.freq)), now, 0.15);
      v.filter.frequency.setTargetAtTime(lowpassHzFor(d), now, 0.15);
      this.setPos(v.pan, this.head[i3]!, this.head[i3 + 1]!, this.head[i3 + 2]!);
    }

    // Water falling from leaf to leaf, during rain and for a while after.
    const wet = Math.max(s.rain, s.afterRain * 0.6);
    this.dripIn -= s.dt * wet * 9;
    if (wet > 0.05 && this.dripIn < 0) {
      this.dripIn = 0.3 + Math.random();
      const a = Math.random() * 6.28;
      const r = 1.5 + Math.random() * 7;
      this.oneShot('drip', s.x + Math.cos(a) * r, s.y - 1 + Math.random() * 3, s.z + Math.sin(a) * r, 52 + Math.random() * 8, 0.7 + Math.random() * 0.9);
    }
  }

  fadeOut(seconds: number): void {
    if (this.ready) this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + seconds);
  }

  setPaused(paused: boolean): void {
    if (!this.ready) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
