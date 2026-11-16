// The night clock. One night at Yasuní, from 17:45 to 06:25, is played in about ten minutes.
// Dusk and dawn are played slower than the middle of the night, so the two choruses have
// room to build. The mapping is piecewise linear and listed here in full.

/** Sunrise and sunset at Tiputini (0.64° S) vary by only about half an hour over the year. */
export const SUNSET_H = 18.15;
export const SUNRISE_H = 6.0;

/** [seconds of play, clock hour]. Hours after midnight are written as 24+. */
export const CLOCK_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 17.75],
  [80, 18.75], // dusk: 45 real seconds per second
  [440, 28.75], // night: 100 real seconds per second
  [620, 30.42], // dawn: about 33 real seconds per second
];

export const NIGHT_SECONDS = CLOCK_KEYS[CLOCK_KEYS.length - 1]![0];

/** Clock hour in [0, 24) for a play time in seconds. */
export function hourAt(playSeconds: number): number {
  return hourAtUnwrapped(playSeconds) % 24;
}

/** Clock hour that keeps counting past midnight (17.75 … 30.42). */
export function hourAtUnwrapped(playSeconds: number): number {
  const t = Math.min(Math.max(playSeconds, 0), NIGHT_SECONDS);
  for (let i = 1; i < CLOCK_KEYS.length; i++) {
    const [t1, h1] = CLOCK_KEYS[i]!;
    const [t0, h0] = CLOCK_KEYS[i - 1]!;
    if (t <= t1) return h0 + ((t - t0) / (t1 - t0)) * (h1 - h0);
  }
  return CLOCK_KEYS[CLOCK_KEYS.length - 1]![1];
}

/** Play time in seconds at which the clock shows the given hour (use 24+ after midnight). */
export function playSecondsAt(hourUnwrapped: number): number {
  for (let i = 1; i < CLOCK_KEYS.length; i++) {
    const [t1, h1] = CLOCK_KEYS[i]!;
    const [t0, h0] = CLOCK_KEYS[i - 1]!;
    if (hourUnwrapped <= h1) return t0 + ((hourUnwrapped - h0) / (h1 - h0)) * (t1 - t0);
  }
  return NIGHT_SECONDS;
}

export function formatClock(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Sun elevation in degrees. On the equator the Sun rises and sets almost vertically,
 * so near the horizon it moves 15° per hour: the reason tropical twilight is so short.
 */
export function sunElevationDeg(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const noon = (SUNRISE_H + SUNSET_H) / 2;
  const half = (SUNSET_H - SUNRISE_H) / 2;
  // Hours from local solar noon, wrapped to [-12, 12].
  let dt = h - noon;
  if (dt > 12) dt -= 24;
  if (dt < -12) dt += 24;
  const beyond = Math.abs(dt) - half; // hours past the horizon crossing (negative by day)
  return Math.max(-90, Math.min(90, -15 * beyond));
}

/**
 * Outdoor illuminance under a clear sky, in lux, for a Sun elevation in degrees.
 * Anchors are the standard twilight values (sunrise ≈ 400 lx, end of civil twilight ≈ 3.4 lx,
 * end of nautical ≈ 0.008 lx, moonless night ≈ 0.001 lx); values between are interpolated in log space.
 */
const LUX_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [-18, 0.001],
  [-12, 0.008],
  [-6, 3.4],
  [0, 400],
  [6, 8000],
  [20, 40000],
  [90, 100000],
];

export function openSkyLux(elevationDeg: number): number {
  if (elevationDeg <= LUX_ANCHORS[0]![0]) return LUX_ANCHORS[0]![1];
  for (let i = 1; i < LUX_ANCHORS.length; i++) {
    const [e1, l1] = LUX_ANCHORS[i]!;
    const [e0, l0] = LUX_ANCHORS[i - 1]!;
    if (elevationDeg <= e1) {
      const k = (elevationDeg - e0) / (e1 - e0);
      return Math.exp(Math.log(l0) + k * (Math.log(l1) - Math.log(l0)));
    }
  }
  return LUX_ANCHORS[LUX_ANCHORS.length - 1]![1];
}

/** Share of open-sky light that reaches the forest floor under a closed canopy. */
export const FLOOR_LIGHT_FRACTION = 0.015;

export function forestFloorLux(hour: number): number {
  return openSkyLux(sunElevationDeg(hour)) * FLOOR_LIGHT_FRACTION;
}

export type Phase = 'dusk' | 'early night' | 'deep night' | 'the lull' | 'first light' | 'dawn chorus';

export function phaseAt(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 17 && h < 18.75) return 'dusk';
  if (h >= 18.75 && h < 23) return 'early night';
  if (h >= 23 || h < 3.5) return 'deep night';
  if (h < 5.0) return 'the lull';
  if (h < 5.75) return 'first light';
  return 'dawn chorus';
}

/**
 * A 0..1 "how much can the eye see without a torch" value used by the renderer.
 * It is the log of floor illuminance, mapped so a moonless night is 0 and sunrise under the canopy is 1.
 */
export function ambientLevel(hour: number): number {
  const lux = forestFloorLux(hour);
  const lo = Math.log10(0.001 * FLOOR_LIGHT_FRACTION);
  const hi = Math.log10(2000 * FLOOR_LIGHT_FRACTION);
  return Math.min(1, Math.max(0, (Math.log10(lux) - lo) / (hi - lo)));
}
