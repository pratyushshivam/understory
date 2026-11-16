import type { Window } from './activity.ts';

export type Group = 'frog' | 'reptile' | 'bird' | 'mammal' | 'invertebrate' | 'fungus';

/** Where in the forest an animal sits. Each maps to a placement rule in world.ts. */
export type Perch =
  | 'litter' // on the leaf litter of the forest floor
  | 'trunk' // on the bark of a large tree, low down
  | 'understory' // on a branch or leaf, 0.5 to 5 m up
  | 'midstory' // 5 to 15 m up
  | 'canopy' // 20 m and higher
  | 'log' // on a fallen log
  | 'stream' // at the edge of the forest stream
  | 'riverbank' // on the bank of the river
  | 'water' // floating in the river
  | 'air' // flying under the canopy
  | 'air-river'; // flying over the river

export type BodyPlan =
  | 'frog'
  | 'toad'
  | 'snake'
  | 'caiman'
  | 'owl'
  | 'potoo'
  | 'nightjar'
  | 'groundbird'
  | 'songbird'
  | 'toucan'
  | 'macaw'
  | 'cat'
  | 'monkey'
  | 'kinkajou'
  | 'rodent'
  | 'tapir'
  | 'opossum'
  | 'armadillo'
  | 'bat'
  | 'spider'
  | 'whipspider'
  | 'ant'
  | 'ants'
  | 'butterfly'
  | 'beetle'
  | 'firefly'
  | 'fungus';

export type Voice =
  | { kind: 'recording'; file: string; credit: string }
  | { kind: 'synth'; recipe: string; note: string }
  | { kind: 'silent'; note: string };

export type Species = {
  id: string;
  common: string;
  scientific: string;
  group: Group;
  body: BodyPlan;
  /** Body length in metres (head and body; wingspan for bats). */
  size: number;
  /** Main and accent colours, as hex numbers. */
  colours: readonly [number, number];
  perch: readonly Perch[];
  /** Height above the ground in metres, low to high. */
  height: readonly [number, number];
  /** When it is out and can be found. */
  active: readonly Window[];
  /** When it calls, and how strongly. Empty for animals that are silent to us. */
  calling: readonly Window[];
  /** Seconds between calls at full strength, low to high. */
  callEvery: readonly [number, number];
  /** Loudness at 1 m in dB and the main frequency in Hz (used for how far the call carries). */
  loudness: readonly [number, number];
  voice: Voice;
  /** Eyeshine: reflectance 0 means no tapetum, so no shine at all. */
  eye: { reflectance: number; pupilMm: number; colour: number; note: string };
  /** Light the animal or fungus makes itself. */
  glow?: { colour: number; pattern: 'steady' | 'flash' | 'pulse'; strength: number; note: string };
  /** How many individuals a night holds, low to high. */
  count: readonly [number, number];
  fact: string;
  source: { label: string; url: string };
  /** Where the record for this site comes from. */
  siteRecord: { label: string; url: string };
  iucn: string;
};

export type Tree = {
  x: number;
  z: number;
  /** Trunk diameter at breast height, metres. */
  dbh: number;
  height: number;
  crownRadius: number;
  kind: 'broadleaf' | 'palm' | 'emergent';
  buttress: boolean;
  tint: number;
};

export type Plant = { x: number; z: number; kind: number; scale: number; rot: number };
export type Log = { x: number; z: number; rot: number; length: number; radius: number; fungi: boolean };
export type Liana = { x: number; z: number; top: number; sway: number; dx: number; dz: number };

export type Animal = {
  index: number;
  species: string;
  perch: Perch;
  x: number;
  y: number;
  z: number;
  /** Direction the animal faces, radians about the vertical. */
  heading: number;
  /** Tree it sits on, if any. */
  tree: number;
  /** Per-animal random number for call timing and small differences. */
  phase: number;
};

export type NightEvent = {
  kind: 'rain' | 'thunder' | 'crack' | 'hush' | 'treefall';
  /** Play time in seconds. */
  at: number;
  duration: number;
};
