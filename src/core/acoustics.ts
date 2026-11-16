// How loud a call is when it reaches you. Two real effects:
// 1. Spreading: sound from a small source loses 6 dB every time the distance doubles.
// 2. The forest itself: leaves, trunks and humid air absorb and scatter sound, and they
//    take high notes first. Measured "excess attenuation" in lowland rainforest is a few
//    dB per 100 m near 1 kHz and climbs steeply above 4 kHz, which is why far calls sound
//    dull and why deep voices (howlers, tinamous, potoos) carry furthest.

/** Extra loss in dB per 100 m on top of spreading, for a frequency in Hz. A smooth fit, not a measurement. */
export function excessAttenuationDbPer100m(freqHz: number): number {
  const k = Math.max(freqHz, 50) / 1000;
  return 2 + 2.2 * k + 0.25 * k * k;
}

/** Sound level in dB at a distance, given the level at 1 m and the call's main frequency. */
export function levelAt(db1m: number, distanceM: number, freqHz: number): number {
  const d = Math.max(distanceM, 1);
  return db1m - 20 * Math.log10(d) - (excessAttenuationDbPer100m(freqHz) * (d - 1)) / 100;
}

/** The quietest level we still play, dB. Roughly a quiet rustle under the insect bed. */
export const AUDIBLE_DB = 18;

/** Distance in metres at which a call drops to the audible floor. */
export function audibleRange(db1m: number, freqHz: number): number {
  let lo = 1;
  let hi = 5000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (levelAt(db1m, mid, freqHz) > AUDIBLE_DB) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Linear gain for the audio graph: 1.0 at 90 dB, so a howler at 20 m is loud and a frog at 60 m is faint. */
export function gainFor(db: number): number {
  return Math.pow(10, (db - 90) / 20);
}

/**
 * Cut-off for a low-pass filter that imitates the forest taking the high notes first:
 * the frequency at which the forest's extra loss over this distance reaches 12 dB.
 */
export function lowpassHzFor(distanceM: number): number {
  const d = Math.max(distanceM, 1);
  let lo = 200;
  let hi = 20000;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if ((excessAttenuationDbPer100m(mid) * d) / 100 < 12) lo = mid;
    else hi = mid;
  }
  return lo;
}
