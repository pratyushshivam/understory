// Torch and eyeshine. Eyeshine is light from your own torch, reflected by a mirror layer
// (the tapetum lucidum) behind the retina and sent straight back the way it came.
// That is why you only see it when the light is close to your eyes, and why its
// brightness falls with the fourth power of distance: the light thins out on the way
// there (1/d²) and again on the way back (1/d²).

export type Vec3 = { x: number; y: number; z: number };

export const TORCH = {
  /** Half-angle of the bright centre of the beam, degrees. */
  innerDeg: 10,
  /** Half-angle at which the beam has faded to nothing, degrees. */
  outerDeg: 25,
  /** Beam strength in candela: a good hand torch (about 300 lumens in this cone). */
  candela: 900,
} as const;

const DEG = Math.PI / 180;

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 1 in the centre of the beam, 0 outside it. `angle` is radians off the beam axis. */
export function beamProfile(angle: number): number {
  return 1 - smooth(TORCH.innerDeg * DEG, TORCH.outerDeg * DEG, Math.abs(angle));
}

/** Angle in radians between the beam axis and the direction from the torch to a point. */
export function angleOffAxis(torch: Vec3, axis: Vec3, point: Vec3): number {
  const dx = point.x - torch.x;
  const dy = point.y - torch.y;
  const dz = point.z - torch.z;
  const d = Math.hypot(dx, dy, dz) || 1e-9;
  const al = Math.hypot(axis.x, axis.y, axis.z) || 1e-9;
  const c = (dx * axis.x + dy * axis.y + dz * axis.z) / (d * al);
  return Math.acos(Math.min(1, Math.max(-1, c)));
}

/** Illuminance in lux that the torch puts on a surface facing it, at a distance in metres. */
export function torchLux(distance: number, angle: number): number {
  const d = Math.max(distance, 0.3);
  return (TORCH.candela * beamProfile(angle)) / (d * d);
}

export type Eye = {
  /** Share of light the tapetum sends back, 0 (no tapetum) to 1. */
  reflectance: number;
  /** Pupil diameter at night, millimetres. */
  pupilMm: number;
};

/**
 * Relative brightness of an animal's eyeshine as seen from the torch.
 * `facing` is the cosine between the animal's gaze and the direction to you (1 = looking at you).
 * Units are arbitrary but consistent, so species and distances compare truthfully.
 */
export function eyeshine(eye: Eye, distance: number, angle: number, facing: number): number {
  if (eye.reflectance <= 0) return 0;
  const d = Math.max(distance, 0.5);
  const lit = torchLux(d, angle); // light arriving at the eye: 1/d²
  const pupilArea = Math.PI * (eye.pupilMm / 2) ** 2; // mm²
  // An eye only returns light when it points roughly at the source.
  const look = smooth(0.25, 0.8, facing);
  return (lit * pupilArea * eye.reflectance * look) / (d * d); // way back: 1/d² again
}

/** Furthest distance in metres at which eyeshine is still above the eye's threshold. */
export function eyeshineRange(eye: Eye, threshold = 0.02): number {
  if (eye.reflectance <= 0) return 0;
  const pupilArea = Math.PI * (eye.pupilMm / 2) ** 2;
  return Math.pow((TORCH.candela * pupilArea * eye.reflectance) / threshold, 0.25);
}
