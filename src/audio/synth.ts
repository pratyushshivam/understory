// Sounds that are made, not recorded: rain, water, wind, footsteps, branches, thunder, and the
// insect and frog voices for which no freely licensed recording exists. Each is rendered once
// into a buffer when the night starts. The README lists which voices are synthesised.

export type Recipe = {
  /** Start and end frequency of each pulse, Hz. */
  f0: number;
  f1: number;
  /** Pulses per call and pulses per second. */
  pulses: number;
  rate: number;
  /** Length of one pulse as a share of the pulse period (0..1). */
  duty: number;
  /** Strength of the 2nd and 3rd harmonics. */
  h2?: number;
  h3?: number;
  /** Seconds of silence after the call (for looped insect songs). */
  gap?: number;
  /** Mix in band noise (katydids, cicadas), 0..1. */
  noise?: number;
  /** Tremolo in Hz inside each pulse (cicada buzz, frog pulsing). */
  am?: number;
  /** Repeat the call this many times inside the buffer. */
  repeats?: number;
};

/** Parses "f0=4800,f1=4800,pulses=3,rate=28,duty=0.6,gap=0.45". */
export function parseRecipe(text: string): Recipe {
  const r: Record<string, number> = { f0: 1000, f1: 1000, pulses: 1, rate: 4, duty: 0.6 };
  for (const part of text.split(',')) {
    const [k, v] = part.split('=');
    if (k && v !== undefined) r[k.trim()] = Number(v);
  }
  return r as unknown as Recipe;
}

let noiseSeed = 1234567;
function rnd(): number {
  noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) | 0;
  return (noiseSeed >>> 0) / 4294967296;
}

export function renderRecipe(r: Recipe, sampleRate: number): Float32Array {
  const period = 1 / r.rate;
  const callLen = r.pulses * period;
  const one = callLen + (r.gap ?? 0);
  const reps = r.repeats ?? 1;
  const out = new Float32Array(Math.ceil(one * reps * sampleRate));
  for (let rep = 0; rep < reps; rep++) {
    for (let p = 0; p < r.pulses; p++) {
      const start = Math.floor((rep * one + p * period) * sampleRate);
      const len = Math.floor(period * r.duty * sampleRate);
      let phase = 0;
      let bp = 0;
      let bp2 = 0;
      for (let i = 0; i < len && start + i < out.length; i++) {
        const t = i / len;
        const f = r.f0 + (r.f1 - r.f0) * t;
        phase += (2 * Math.PI * f) / sampleRate;
        const env = Math.sin(Math.PI * t) ** 0.7;
        let s = Math.sin(phase) + (r.h2 ?? 0) * Math.sin(2 * phase) + (r.h3 ?? 0) * Math.sin(3 * phase);
        if (r.noise) {
          // A two-pole resonator around f turns white noise into a hissy band.
          const w = (2 * Math.PI * f) / sampleRate;
          const q = 0.985;
          const y = (rnd() * 2 - 1) * 0.12 + 2 * q * Math.cos(w) * bp - q * q * bp2;
          bp2 = bp;
          bp = y;
          s = s * (1 - r.noise) + y * r.noise * 2.2;
        }
        if (r.am) s *= 0.55 + 0.45 * Math.sin((2 * Math.PI * r.am * i) / sampleRate);
        out[start + i] = s * env * 0.5;
      }
    }
  }
  return out;
}

function onePole(data: Float32Array, cutoff: number, sampleRate: number, high = false): Float32Array {
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    y = (1 - a) * data[i]! + a * y;
    data[i] = high ? data[i]! - y : y;
  }
  return data;
}

function white(seconds: number, sampleRate: number): Float32Array {
  const d = new Float32Array(Math.floor(seconds * sampleRate));
  for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  return d;
}

/** Makes the two ends of a loop meet without a click. */
function seamless(d: Float32Array, sampleRate: number): Float32Array {
  const n = Math.floor(0.25 * sampleRate);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    d[i] = d[i]! * k + d[d.length - n + i]! * (1 - k);
  }
  return d.subarray(0, d.length - n);
}

function normalise(d: Float32Array, peak = 0.8): Float32Array {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]!));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] = (d[i]! / m) * peak;
  return d;
}

export type Made = Record<
  'rain' | 'river' | 'stream' | 'wind' | 'step' | 'stepWet' | 'crack' | 'thunder' | 'rustle' | 'treefall' | 'drip' | 'farChorus' | 'splash',
  Float32Array
>;

export function renderWorldSounds(sr: number): Made {
  // Rain on leaves: hiss with a little grit.
  const rain = white(5, sr);
  onePole(rain, 9000, sr);
  onePole(rain, 500, sr, true);
  for (let i = 0; i < rain.length; i++) rain[i] = rain[i]! * (0.75 + 0.25 * Math.sin(i * 0.00021) * Math.sin(i * 0.000057));

  const river = white(6, sr);
  onePole(river, 520, sr);
  onePole(river, 320, sr);
  onePole(river, 40, sr, true);

  const stream = white(5, sr);
  onePole(stream, 4200, sr);
  onePole(stream, 900, sr, true);
  for (let i = 0; i < stream.length; i++) stream[i] = stream[i]! * (0.6 + 0.4 * Math.sin(i * 0.0031) * Math.sin(i * 0.00083 + 1));

  const wind = white(9, sr);
  onePole(wind, 700, sr);
  onePole(wind, 420, sr);
  onePole(wind, 120, sr, true);
  for (let i = 0; i < wind.length; i++) wind[i] = wind[i]! * (0.5 + 0.5 * Math.sin((i / wind.length) * Math.PI * 2) ** 2);

  const burst = (seconds: number, lo: number, hi: number, decay: number) => {
    const d = white(seconds, sr);
    onePole(d, hi, sr);
    onePole(d, lo, sr, true);
    for (let i = 0; i < d.length; i++) d[i] = d[i]! * Math.exp((-i / sr) * decay);
    return d;
  };
  const step = burst(0.16, 700, 5200, 34);
  const stepWet = burst(0.2, 300, 2600, 22);

  // A dry branch giving way: a sharp snap, a second smaller one, and the settle.
  const crack = new Float32Array(Math.floor(1.3 * sr));
  const addAt = (target: Float32Array, src: Float32Array, at: number, gain: number) => {
    const o = Math.floor(at * sr);
    for (let i = 0; i < src.length && o + i < target.length; i++) target[o + i] = target[o + i]! + src[i]! * gain;
  };
  addAt(crack, burst(0.09, 900, 9000, 70), 0, 1);
  addAt(crack, burst(0.3, 120, 900, 16), 0.005, 0.8);
  addAt(crack, burst(0.07, 1200, 8000, 80), 0.21, 0.5);
  addAt(crack, burst(0.5, 500, 4000, 9), 0.3, 0.16);

  const thunder = white(7, sr);
  onePole(thunder, 140, sr);
  onePole(thunder, 90, sr);
  for (let i = 0; i < thunder.length; i++) {
    const t = i / sr;
    thunder[i] = thunder[i]! * (Math.exp(-t * 0.55) * (0.6 + 0.4 * Math.sin(t * 9) * Math.sin(t * 3.1)) * Math.min(1, t * 6));
  }

  // Something heavy moving through wet leaves, unhurried.
  const rustle = new Float32Array(Math.floor(5 * sr));
  for (let k = 0; k < 9; k++) addAt(rustle, burst(0.28, 500, 4200, 13), 0.15 + k * 0.5 + rnd() * 0.12, 0.9 - k * 0.07);

  const treefall = new Float32Array(Math.floor(7 * sr));
  for (let k = 0; k < 7; k++) addAt(treefall, burst(0.1, 700, 7000, 55), k * 0.22 * (1 - k * 0.05) + rnd() * 0.05, 0.3 + k * 0.09);
  const whoosh = white(2.4, sr);
  onePole(whoosh, 1800, sr);
  for (let i = 0; i < whoosh.length; i++) whoosh[i] = whoosh[i]! * Math.sin((i / whoosh.length) * Math.PI) ** 2;
  addAt(treefall, whoosh, 1.5, 0.5);
  addAt(treefall, burst(1.6, 30, 160, 3.2), 3.5, 2.6);
  addAt(treefall, burst(1.2, 400, 3000, 5), 3.55, 0.4);

  const drip = new Float32Array(Math.floor(0.12 * sr));
  for (let i = 0; i < drip.length; i++) {
    const t = i / sr;
    drip[i] = Math.sin(2 * Math.PI * (1500 + 2600 * t * 8) * t) * Math.exp(-t * 55) * 0.6;
  }

  const splash = burst(0.45, 250, 3000, 9);

  // The insects beyond the patch you can walk: many voices, none close enough to place.
  const far = new Float32Array(Math.floor(6 * sr));
  for (let k = 0; k < 22; k++) {
    const f = 3200 + rnd() * 5200;
    const rate = 6 + rnd() * 40;
    const phase0 = rnd() * 6.28;
    const g = 0.03 + rnd() * 0.05;
    for (let i = 0; i < far.length; i++) {
      const t = i / sr;
      const env = Math.max(0, Math.sin(2 * Math.PI * rate * t + phase0)) ** 2;
      far[i] = far[i]! + Math.sin(2 * Math.PI * f * t) * env * g;
    }
  }

  return {
    rain: normalise(seamless(rain, sr)),
    river: normalise(seamless(river, sr)),
    stream: normalise(seamless(stream, sr)),
    wind: normalise(seamless(wind, sr)),
    step: normalise(step, 0.6),
    stepWet: normalise(stepWet, 0.6),
    crack: normalise(crack, 0.95),
    thunder: normalise(thunder, 0.9),
    rustle: normalise(rustle, 0.7),
    treefall: normalise(treefall, 0.9),
    drip: normalise(drip, 0.5),
    farChorus: normalise(seamless(far, sr), 0.5),
    splash: normalise(splash, 0.6),
  };
}
