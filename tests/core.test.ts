import { describe, expect, it } from 'vitest';
import { audibleRange, excessAttenuationDbPer100m, levelAt, lowpassHzFor } from '../src/core/acoustics.ts';
import { firstOnsetAfter, strengthAt } from '../src/core/activity.ts';
import { TORCH, angleOffAxis, beamProfile, eyeshine, eyeshineRange, torchLux } from '../src/core/optics.ts';
import { makeRng, nightNumberFor } from '../src/core/rng.ts';
import {
  CLOCK_KEYS,
  NIGHT_SECONDS,
  ambientLevel,
  forestFloorLux,
  formatClock,
  hourAt,
  hourAtUnwrapped,
  openSkyLux,
  phaseAt,
  playSecondsAt,
  sunElevationDeg,
} from '../src/core/time.ts';

describe('the night clock', () => {
  it('starts at 17:45 and ends at 06:25', () => {
    expect(formatClock(hourAt(0))).toBe('17:45');
    expect(formatClock(hourAt(NIGHT_SECONDS))).toBe('06:25');
  });
  it('never runs backwards and passes every key', () => {
    let last = -1;
    for (let t = 0; t <= NIGHT_SECONDS; t += 0.5) {
      const h = hourAtUnwrapped(t);
      expect(h).toBeGreaterThanOrEqual(last);
      last = h;
    }
    for (const [t, h] of CLOCK_KEYS) expect(hourAtUnwrapped(t)).toBeCloseTo(h, 6);
  });
  it('inverts: seconds to hour and back', () => {
    for (const t of [0, 40, 80, 200, 440, 500, 620]) expect(playSecondsAt(hourAtUnwrapped(t))).toBeCloseTo(t, 6);
  });
  it('plays dusk and dawn slower than the middle of the night', () => {
    const rate = (a: number, b: number) => (hourAtUnwrapped(b) - hourAtUnwrapped(a)) / (b - a);
    expect(rate(0, 80)).toBeLessThan(rate(80, 440));
    expect(rate(440, 620)).toBeLessThan(rate(80, 440));
  });
  it('names the phases in order', () => {
    const seen: string[] = [];
    for (let t = 0; t <= NIGHT_SECONDS; t += 1) {
      const p = phaseAt(hourAt(t));
      if (seen[seen.length - 1] !== p) seen.push(p);
    }
    expect(seen).toEqual(['dusk', 'early night', 'deep night', 'the lull', 'first light', 'dawn chorus']);
  });
});

describe('the sun at the equator', () => {
  it('is on the horizon at sunrise and sunset', () => {
    expect(sunElevationDeg(6.0)).toBeCloseTo(0, 6);
    expect(sunElevationDeg(18.15)).toBeCloseTo(0, 6);
  });
  it('moves 15 degrees an hour near the horizon, so civil twilight lasts 24 minutes', () => {
    expect(sunElevationDeg(6.0 - 24 / 60)).toBeCloseTo(-6, 6);
    expect(sunElevationDeg(18.15 + 24 / 60)).toBeCloseTo(-6, 6);
  });
  it('is far below the horizon at midnight', () => {
    expect(sunElevationDeg(0)).toBeLessThan(-60);
  });
  it('matches the standard twilight illuminance anchors', () => {
    expect(openSkyLux(0)).toBeCloseTo(400, 6);
    expect(openSkyLux(-6)).toBeCloseTo(3.4, 6);
    expect(openSkyLux(-12)).toBeCloseTo(0.008, 6);
    expect(openSkyLux(-40)).toBeCloseTo(0.001, 6);
  });
  it('puts 1.5% of sky light on the forest floor', () => {
    expect(forestFloorLux(6.0)).toBeCloseTo(6, 6);
  });
  it('gives an ambient level that only rises through the dawn', () => {
    let last = -1;
    for (let h = 3; h <= 6.4; h += 0.05) {
      const a = ambientLevel(h);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(ambientLevel(1)).toBe(0);
    expect(ambientLevel(6.4)).toBeGreaterThan(0.6);
  });
});

describe('torch and eyeshine', () => {
  const caiman = { reflectance: 0.9, pupilMm: 10 };
  it('is full strength on the axis and dark outside the cone', () => {
    expect(beamProfile(0)).toBe(1);
    expect(beamProfile(((TORCH.outerDeg + 1) * Math.PI) / 180)).toBe(0);
  });
  it('obeys the inverse square law', () => {
    expect(torchLux(10, 0)).toBeCloseTo(TORCH.candela / 100, 9);
    expect(torchLux(20, 0) / torchLux(10, 0)).toBeCloseTo(0.25, 9);
  });
  it('makes eyeshine fall with the fourth power of distance', () => {
    expect(eyeshine(caiman, 20, 0, 1) / eyeshine(caiman, 10, 0, 1)).toBeCloseTo(1 / 16, 9);
    expect(eyeshine(caiman, 40, 0, 1) / eyeshine(caiman, 10, 0, 1)).toBeCloseTo(1 / 256, 9);
  });
  it('gives no eyeshine without a tapetum, outside the beam, or when the animal looks away', () => {
    expect(eyeshine({ reflectance: 0, pupilMm: 10 }, 5, 0, 1)).toBe(0);
    expect(eyeshine(caiman, 5, 1.0, 1)).toBe(0);
    expect(eyeshine(caiman, 5, 0, 0)).toBe(0);
  });
  it('grows with the area of the pupil', () => {
    const big = eyeshine({ reflectance: 0.9, pupilMm: 10 }, 10, 0, 1);
    const small = eyeshine({ reflectance: 0.9, pupilMm: 5 }, 10, 0, 1);
    expect(big / small).toBeCloseTo(4, 9);
  });
  it('lets a caiman be seen much further off than a spider', () => {
    expect(eyeshineRange(caiman)).toBeGreaterThan(3 * eyeshineRange({ reflectance: 0.6, pupilMm: 0.9 }));
    expect(eyeshine(caiman, eyeshineRange(caiman, 0.02), 0, 1)).toBeCloseTo(0.02, 6);
  });
  it('measures the angle off the beam axis', () => {
    const o = { x: 0, y: 0, z: 0 };
    expect(angleOffAxis(o, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -5 })).toBeCloseTo(0, 9);
    expect(angleOffAxis(o, { x: 0, y: 0, z: -1 }, { x: 5, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('sound in the forest', () => {
  it('loses 6 dB per doubling of distance, plus what the forest takes', () => {
    const f = 1000;
    const spread = levelAt(90, 10, f) - levelAt(90, 20, f);
    expect(spread).toBeCloseTo(20 * Math.log10(2) + (excessAttenuationDbPer100m(f) * 10) / 100, 9);
  });
  it('takes high notes first', () => {
    expect(excessAttenuationDbPer100m(8000)).toBeGreaterThan(excessAttenuationDbPer100m(1000) * 3);
    expect(lowpassHzFor(200)).toBeLessThan(lowpassHzFor(20));
  });
  it('carries a deep roar much further than a high insect song of the same loudness', () => {
    expect(audibleRange(100, 400)).toBeGreaterThan(2 * audibleRange(100, 8000));
  });
  it('lets a howler be heard across the whole site', () => {
    expect(audibleRange(104, 400)).toBeGreaterThan(300);
  });
});

describe('activity windows', () => {
  it('handles windows that wrap midnight', () => {
    const night = [[18.4, 5.6, 1]] as const;
    expect(strengthAt(night, 23)).toBe(1);
    expect(strengthAt(night, 2)).toBe(1);
    expect(strengthAt(night, 12)).toBe(0);
    expect(strengthAt(night, 18.0)).toBe(0);
  });
  it('fades in rather than snapping on', () => {
    const w = [[19, 21, 1]] as const;
    expect(strengthAt(w, 18.9)).toBeGreaterThan(0);
    expect(strengthAt(w, 18.9)).toBeLessThan(1);
    expect(strengthAt(w, 20)).toBe(1);
  });
  it('finds the first onset after a given hour', () => {
    // Half strength is reached half way through the quarter-hour fade-in.
    expect(firstOnsetAfter([[5.25, 6.3, 1]], 17)).toBeCloseTo(5.25 - 0.125, 1);
    expect(firstOnsetAfter([], 17)).toBeNull();
  });
});

describe('the seed', () => {
  it('repeats exactly', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('gives independent streams that do not disturb each other', () => {
    const a = makeRng(42);
    const fa = a.fork('trees');
    const b = makeRng(42);
    b();
    b();
    const fb = b.fork('trees');
    expect(fa()).toBe(fb());
  });
  it('numbers the nights by date, changing at noon', () => {
    expect(nightNumberFor(new Date(2026, 0, 1, 20))).toBe(1);
    expect(nightNumberFor(new Date(2026, 0, 2, 3))).toBe(1);
    expect(nightNumberFor(new Date(2026, 0, 2, 20))).toBe(2);
  });
});
