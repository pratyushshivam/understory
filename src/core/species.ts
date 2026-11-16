// Every animal, fungus and insect group in the night, with where it sits, when it is out,
// when it calls, what its eyes do in torchlight, and where each claim comes from.
// All are recorded from Yasuní; the record for each is linked in `siteRecord`.

import type { Window } from './activity.ts';
import { RECORDINGS } from './recordings.ts';
import type { BodyPlan, Group, Perch, Species, Voice } from './types.ts';

type Src = { label: string; url: string };
const wiki = (page: string): Src => ({ label: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${page}` });
const CH2003: Src = {
  label: 'Cisneros-Heredia 2003, herpetofauna of Tiputini Biodiversity Station',
  url: 'https://multimedia20stg.blob.core.windows.net/publicaciones/Cisneros_Heredia_2003.pdf',
};
const BLAKE2021: Src = { label: 'Blake 2021, acoustic monitors at Tiputini', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7811295/' };
const BLAKE2015: Src = { label: 'Blake & Loiselle 2015, Tiputini bird plots', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4558082/' };
const BASS2010: Src = { label: 'Bass et al. 2010, PLoS ONE', url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0008767' };
const BLANCHETTE: Src = { label: 'Blanchette 2024, Fungi 17:1', url: 'https://www.fungimag.com/v17i1/V17I1-Blanchette.pdf' };
const inat = (taxon: string): Src => ({
  label: 'iNaturalist, research-grade records in the Yasuní Biosphere Reserve',
  url: `https://www.inaturalist.org/observations?place_id=141387&quality_grade=research&taxon_name=${encodeURIComponent(taxon)}`,
});

const NIGHT: Window[] = [[18.4, 5.6, 1]];
const DAY: Window[] = [[5.5, 18.5, 1]];
const ALWAYS: Window[] = [[0, 24, 1]];

// Eyeshine, by group. Colours are sourced at group level unless a note says otherwise.
const EYE = {
  none: (note = 'No reflecting layer: its eyes do not shine.') => ({ reflectance: 0, pupilMm: 0, colour: 0, note }),
  frog: (mm: number) => ({ reflectance: 0.35, pupilMm: mm, colour: 0x9dffb0, note: 'Frogs: green eyeshine (group level).' }),
  croc: (mm: number) => ({ reflectance: 0.9, pupilMm: mm, colour: 0xff5a22, note: 'Crocodilians have a tapetum; red-orange is the colour reported for caimans and alligators (group level).' }),
  owl: (mm: number) => ({ reflectance: 0.45, pupilMm: mm, colour: 0xff5236, note: 'Most owls: red eyeshine (group level).' }),
  nightbird: (mm: number, note: string) => ({ reflectance: 0.75, pupilMm: mm, colour: 0xff9a3c, note }),
  cat: (mm: number, note: string) => ({ reflectance: 0.9, pupilMm: mm, colour: 0xf0d264, note }),
  red: (mm: number, note: string) => ({ reflectance: 0.6, pupilMm: mm, colour: 0xff4a2c, note }),
  spider: (mm: number) => ({ reflectance: 0.6, pupilMm: mm, colour: 0x8dffc8, note: 'Spiders: green sparkle from the mirror layer in their side eyes (group level).' }),
};

type Row = {
  id: string;
  common: string;
  scientific: string;
  group: Group;
  body: BodyPlan;
  size: number;
  colours: [number, number];
  perch: Perch[];
  height?: [number, number];
  active?: Window[];
  calling?: Window[];
  callEvery?: [number, number];
  loudness?: [number, number];
  synth?: { recipe: string; note: string };
  silentNote?: string;
  eye: Species['eye'];
  glow?: Species['glow'];
  count: [number, number];
  fact: string;
  source: Src;
  siteRecord: Src;
  iucn?: string;
};

const NO_RECORDING = 'No recording with a licence that allows sharing was found, so this animal is silent here.';

function make(r: Row): Species {
  const rec = RECORDINGS[r.id];
  let voice: Voice;
  if (rec) voice = { kind: 'recording', file: rec.file, credit: rec.credit };
  else if (r.synth) voice = { kind: 'synth', recipe: r.synth.recipe, note: r.synth.note };
  else voice = { kind: 'silent', note: r.silentNote ?? (r.calling ? NO_RECORDING : 'Makes no sound a person would notice.') };
  return {
    id: r.id,
    common: r.common,
    scientific: r.scientific,
    group: r.group,
    body: r.body,
    size: r.size,
    colours: r.colours,
    perch: r.perch,
    height: r.height ?? [0, 0.05],
    active: r.active ?? NIGHT,
    calling: voice.kind === 'silent' ? [] : (r.calling ?? []),
    callEvery: r.callEvery ?? [10, 22],
    loudness: r.loudness ?? [82, 1500],
    voice,
    eye: r.eye,
    glow: r.glow,
    count: r.count,
    fact: r.fact,
    source: r.source,
    siteRecord: r.siteRecord,
    iucn: r.iucn ?? 'Least Concern',
  };
}

const rows: Row[] = [
  // ───────────── Frogs ─────────────
  {
    id: 'smoky-jungle-frog', common: 'Smoky jungle frog', scientific: 'Leptodactylus pentadactylus', group: 'frog', body: 'frog',
    size: 0.17, colours: [0x6b4a2e, 0xc9b08a], perch: ['litter', 'stream'],
    calling: [[18.6, 23, 1], [23, 4, 0.4]], callEvery: [6, 14], loudness: [92, 700], eye: EYE.frog(7), count: [3, 5],
    fact: 'The male whips air, water and eggs into a foam nest with his back legs. It holds about 1,000 eggs, which hatch in two to three days.',
    source: wiki('Smoky_jungle_frog'), siteRecord: CH2003,
  },
  {
    id: 'slender-legged-treefrog', common: 'Manaus slender-legged tree frog', scientific: 'Osteocephalus taurinus', group: 'frog', body: 'frog',
    size: 0.085, colours: [0x7a6a4a, 0xd8cfa8], perch: ['understory', 'trunk'], height: [0.5, 4],
    calling: [[18.8, 1, 0.8]], callEvery: [8, 18], loudness: [84, 1200], eye: EYE.frog(5), count: [4, 6],
    fact: 'A female lays about 2,000 black eggs as a film on the water surface. The tadpoles eat frog eggs, even those of their own kind.',
    source: wiki('Osteocephalus_taurinus'), siteRecord: CH2003,
  },
  {
    id: 'rocket-treefrog', common: 'Rocket tree frog', scientific: 'Boana lanciformis', group: 'frog', body: 'frog',
    size: 0.08, colours: [0xb08a52, 0xe9dcb4], perch: ['stream', 'understory'], height: [0.4, 2],
    calling: [[18.6, 2, 0.9]], callEvery: [5, 12], loudness: [86, 1800], eye: EYE.frog(5), count: [3, 5],
    fact: 'Unusually tolerant for a rainforest frog: it also lives in gardens and in land that used to be forest.',
    source: wiki('Boana_lanciformis'), siteRecord: CH2003,
  },
  {
    id: 'gladiator-treefrog', common: 'Giant gladiator tree frog', scientific: 'Boana boans', group: 'frog', body: 'frog',
    size: 0.11, colours: [0x8a6a44, 0xd8c8a0], perch: ['riverbank'],
    calling: [[19, 2, 0.8]], callEvery: [7, 15], loudness: [88, 900], eye: EYE.frog(6), count: [2, 4],
    fact: 'One of the largest tree frogs of the Amazon, and a frog of river edges: you will only meet it near the water.',
    source: wiki('Boana_boans'), siteRecord: CH2003,
  },
  {
    id: 'cane-toad', common: 'Cane toad', scientific: 'Rhinella marina', group: 'frog', body: 'toad',
    size: 0.13, colours: [0x6a5a40, 0x8a7a5a], perch: ['litter'],
    calling: [[19, 24, 0.5]], callEvery: [14, 28], loudness: [84, 600], eye: EYE.frog(6), count: [3, 4],
    fact: 'Here the cane toad is a native animal, at home. Only about one in 200 is thought to survive to adulthood.',
    source: wiki('Cane_toad'), siteRecord: CH2003,
  },
  {
    id: 'white-lined-leaf-frog', common: 'White-lined leaf frog', scientific: 'Phyllomedusa vaillantii', group: 'frog', body: 'frog',
    size: 0.06, colours: [0x3f8f3a, 0xe8e8d0], perch: ['understory', 'stream'], height: [0.5, 3],
    calling: [[19, 2, 0.6]], callEvery: [12, 26], loudness: [72, 1500], eye: EYE.frog(4), count: [2, 4],
    fact: 'Its eggs are wrapped in a leaf nest that hangs over water. When the tadpoles hatch they simply drop into the pool below.',
    source: wiki('Phyllomedusa_vaillantii'), siteRecord: CH2003,
  },
  {
    id: 'tiger-striped-leaf-frog', common: 'Tiger-striped leaf frog', scientific: 'Callimedusa tomopterna', group: 'frog', body: 'frog',
    size: 0.05, colours: [0x4a9a3c, 0xe8862a], perch: ['understory'], height: [0.6, 3],
    calling: [[19, 2, 0.6]], callEvery: [12, 26], loudness: [72, 1800], eye: EYE.frog(4), count: [2, 3],
    fact: 'Green above, orange with dark stripes on its flanks and legs. It glues its eggs to leaves over still water so the tadpoles fall in.',
    source: wiki('Callimedusa_tomopterna'), siteRecord: CH2003,
  },
  {
    id: 'triangle-treefrog', common: 'Triangle tree frog', scientific: 'Dendropsophus triangulum', group: 'frog', body: 'frog',
    size: 0.03, colours: [0xd8b04a, 0x6a4a2a], perch: ['stream'], height: [0, 0.3],
    calling: [[18.8, 1, 0.8]], callEvery: [5, 11], loudness: [78, 3000], eye: EYE.frog(3), count: [3, 5],
    fact: 'It breeds at pools left by the rain, laying its eggs on leaves above them so the tadpoles finish growing in the water.',
    source: wiki('Dendropsophus_triangulum'), siteRecord: CH2003,
  },
  {
    id: 'milk-frog', common: 'Amazon milk frog', scientific: 'Trachycephalus cunauaru', group: 'frog', body: 'frog',
    size: 0.07, colours: [0x8a7a5a, 0xd8d0b8], perch: ['canopy'], height: [18, 30],
    calling: [[19, 3, 0.7]], callEvery: [14, 30], loudness: [90, 700], eye: EYE.frog(5), count: [2, 3],
    fact: 'It lives almost its whole life in the canopy. Males call from water-filled tree holes, where a female may lay about 1,000 eggs.',
    source: wiki('Trachycephalus_cunauaru'), siteRecord: inat('Trachycephalus cunauaru'),
  },
  {
    id: 'ecuador-poison-frog', common: 'Ecuador poison frog', scientific: 'Ameerega bilinguis', group: 'frog', body: 'frog',
    size: 0.02, colours: [0x8a2318, 0x2a55b8], perch: ['litter'], active: [[5.6, 18.4, 1]],
    calling: [[5.8, 7, 0.8], [17, 18.3, 0.5]], callEvery: [8, 16], loudness: [70, 4000], eye: EYE.none('A frog of the day: no eyeshine is drawn.'), count: [3, 5],
    fact: 'A frog of the day, gone by dark. The father guards 4 to 16 eggs on the leaf litter for about three weeks, then carries the tadpoles on his back to water.',
    source: wiki('Ameerega_bilinguis'), siteRecord: CH2003,
  },

  // ───────────── Reptiles ─────────────
  {
    id: 'amazon-tree-boa', common: 'Amazon tree boa', scientific: 'Corallus hortulana', group: 'reptile', body: 'snake',
    size: 1.4, colours: [0x8a6a3c, 0x5a4428], perch: ['understory', 'midstory'], height: [1.5, 8],
    eye: { reflectance: 0.5, pupilMm: 4, colour: 0xffc070, note: 'One of the few snakes with eyeshine (species level). The colour drawn is an assumption.' }, count: [2, 3],
    fact: 'One of the few snakes whose eyes shine back in torchlight, thanks to a reflecting layer behind the eye.',
    source: wiki('Corallus_hortulana'), siteRecord: CH2003,
  },
  {
    id: 'lancehead', common: 'Common lancehead', scientific: 'Bothrops atrox', group: 'reptile', body: 'snake',
    size: 1.0, colours: [0x5e4a30, 0x3a2c1c], perch: ['litter'], eye: EYE.none('No eyeshine could be sourced, so none is drawn.'), count: [2, 3],
    fact: 'It can lie perfectly still in the leaf litter for hours, which is why people who walk here at night watch every step.',
    source: wiki('Bothrops_atrox'), siteRecord: CH2003,
  },
  {
    id: 'blunt-headed-tree-snake', common: 'Blunt-headed tree snake', scientific: 'Imantodes cenchoa', group: 'reptile', body: 'snake',
    size: 0.8, colours: [0xb8905a, 0x4a3320], perch: ['understory'], height: [0.8, 3],
    eye: EYE.none('No eyeshine could be sourced, so none is drawn.'), count: [3, 4],
    fact: 'A pencil-thin night snake with huge eyes that picks sleeping lizards and frogs off leaves. Harmless to people.',
    source: wiki('Imantodes_cenchoa'), siteRecord: CH2003,
  },
  {
    id: 'rainbow-boa', common: 'Rainbow boa', scientific: 'Epicrates cenchria', group: 'reptile', body: 'snake',
    size: 1.5, colours: [0x8a3c1e, 0x2a1810], perch: ['litter', 'log'], eye: EYE.none('No eyeshine could be sourced, so none is drawn.'), count: [1, 2],
    fact: 'Its scales shimmer like oil on water in torchlight. The rainbow comes from the microscopic structure of the scales, not from pigment.',
    source: wiki('Epicrates_cenchria'), siteRecord: CH2003,
  },
  {
    id: 'smooth-fronted-caiman', common: 'Smooth-fronted caiman', scientific: 'Paleosuchus trigonatus', group: 'reptile', body: 'caiman',
    size: 1.5, colours: [0x3a3424, 0x5a5238], perch: ['stream'], eye: EYE.croc(9), count: [2, 3],
    fact: 'The caiman of small forest streams. It builds its nest of leaves against a termite mound, and the warmth of the mound helps hatch the eggs.',
    source: wiki('Smooth-fronted_caiman'), siteRecord: CH2003,
  },
  {
    id: 'black-caiman', common: 'Black caiman', scientific: 'Melanosuchus niger', group: 'reptile', body: 'caiman',
    size: 2.8, colours: [0x15150f, 0x2a2a20], perch: ['water'], eye: EYE.croc(12), count: [3, 5],
    fact: 'The biggest predator of the Amazon. Most adults are 2 to 3 metres long; a few old males pass 5 metres.',
    source: wiki('Black_caiman'), siteRecord: CH2003,
  },
  {
    id: 'spectacled-caiman', common: 'Spectacled caiman', scientific: 'Caiman crocodilus', group: 'reptile', body: 'caiman',
    size: 1.8, colours: [0x4a4630, 0x6a6444], perch: ['water', 'riverbank'], eye: EYE.croc(10), count: [4, 6],
    fact: 'The most widespread caiman of all, found in 17 countries, and a hunter of the night.',
    source: wiki('Spectacled_caiman'), siteRecord: CH2003,
  },

  // ───────────── Birds of the night ─────────────
  {
    id: 'common-potoo', common: 'Common potoo', scientific: 'Nyctibius griseus', group: 'bird', body: 'potoo',
    size: 0.36, colours: [0x6e6558, 0x3e372c], perch: ['midstory'], height: [5, 8],
    calling: [[18.45, 21, 1], [21, 4.5, 0.45], [4.5, 5.7, 0.9]], callEvery: [9, 16], loudness: [90, 1200],
    eye: EYE.nightbird(14, 'Potoos shine brightly in torchlight (sourced for the great potoo). The orange drawn is an assumption.'), count: [3, 4],
    fact: 'It can watch you with its eyes shut: two or three slits in each eyelid let it see while it pretends to be a dead branch.',
    source: wiki('Common_potoo'), siteRecord: inat('Nyctibius griseus'),
  },
  {
    id: 'great-potoo', common: 'Great potoo', scientific: 'Nyctibius grandis', group: 'bird', body: 'potoo',
    size: 0.54, colours: [0xb8b0a0, 0x7a7262], perch: ['canopy'], height: [18, 28],
    calling: [[19, 4, 0.5]], callEvery: [26, 50], loudness: [96, 500],
    eye: EYE.nightbird(18, 'Its eyeshine in a torch beam is what gives it away (species level). The orange drawn is an assumption.'), count: [1, 2],
    fact: 'By day it sits bolt upright and passes for a broken stump. At night its eyeshine in a torch beam gives it away.',
    source: wiki('Great_potoo'), siteRecord: inat('Nyctibius grandis'),
  },
  {
    id: 'screech-owl', common: 'Tawny-bellied screech owl', scientific: 'Megascops watsonii', group: 'bird', body: 'owl',
    size: 0.22, colours: [0x6a4a2c, 0xa87840], perch: ['understory', 'midstory'], height: [3, 10],
    calling: [[18.6, 5.85, 0.9]], callEvery: [11, 22], loudness: [82, 600], eye: EYE.owl(10), count: [3, 4],
    fact: 'A common voice of the night forest that almost nobody sees. At Tiputini it is still calling when the dawn recorders start at 05:45.',
    source: wiki('Tawny-bellied_screech_owl'), siteRecord: BLAKE2021,
  },
  {
    id: 'crested-owl', common: 'Crested owl', scientific: 'Lophostrix cristata', group: 'bird', body: 'owl',
    size: 0.4, colours: [0x5a4026, 0x8a5a30], perch: ['midstory'], height: [5, 10],
    calling: [[19, 5, 0.6]], callEvery: [20, 40], loudness: [86, 350], eye: EYE.owl(13), count: [2, 2],
    fact: 'This owl hunts bats. Two were once seen taking bats straight out of the nets researchers had set to catch them.',
    source: wiki('Crested_owl'), siteRecord: inat('Lophostrix cristata'),
  },
  {
    id: 'spectacled-owl', common: 'Spectacled owl', scientific: 'Pulsatrix perspicillata', group: 'bird', body: 'owl',
    size: 0.46, colours: [0x2e241a, 0xe8d8a0], perch: ['midstory', 'canopy'], height: [10, 22],
    calling: [[18.8, 5.5, 0.5]], callEvery: [26, 50], loudness: [88, 300], eye: EYE.owl(14), count: [1, 2],
    fact: 'Pairs sing duets on calm nights. One was recorded taking a three-toed sloth more than four times its own weight.',
    source: wiki('Spectacled_owl'), siteRecord: inat('Pulsatrix perspicillata'),
  },
  {
    id: 'pauraque', common: 'Common pauraque', scientific: 'Nyctidromus albicollis', group: 'bird', body: 'nightjar',
    size: 0.25, colours: [0x6a5a44, 0xd8cfc0], perch: ['litter'],
    calling: [[18.35, 20, 1], [20, 4.8, 0.3], [4.8, 5.8, 0.9]], callEvery: [6, 13], loudness: [86, 1500],
    eye: EYE.nightbird(9, 'Many nightjars have a tapetum (group level). The orange drawn is an assumption.'), count: [2, 3],
    fact: 'It builds no nest at all. Its two pinkish eggs are laid straight onto bare ground or leaf litter.',
    source: wiki('Pauraque'), siteRecord: inat('Nyctidromus albicollis'),
  },
  {
    id: 'ocellated-poorwill', common: 'Ocellated poorwill', scientific: 'Nyctiphrynus ocellatus', group: 'bird', body: 'nightjar',
    size: 0.2, colours: [0x4a3626, 0xe8e0d0], perch: ['understory'], height: [1, 3],
    calling: [[18.5, 20.5, 0.8], [4.5, 5.7, 0.7]], callEvery: [8, 16], loudness: [82, 1800],
    eye: EYE.nightbird(8, 'Many nightjars have a tapetum (group level). The orange drawn is an assumption.'), count: [2, 2],
    fact: 'Named for the white spots on its belly, which look a little like eyes. It hunts from a low perch inside the forest.',
    source: wiki('Ocellated_poorwill'), siteRecord: inat('Nyctiphrynus ocellatus'),
  },

  // ───────────── Birds of dusk and dawn ─────────────
  {
    id: 'great-tinamou', common: 'Great tinamou', scientific: 'Tinamus major', group: 'bird', body: 'groundbird',
    size: 0.42, colours: [0x6a5a3a, 0x8a7a5a], perch: ['litter'], active: DAY,
    calling: [[17.5, 18.7, 1], [5.4, 6.5, 0.7]], callEvery: [12, 24], loudness: [92, 1300], eye: EYE.none(), count: [2, 3],
    fact: 'Its three trembling whistles close the day. Its eggs are glossy bright blue or violet, laid between the buttress roots of a tree.',
    source: wiki('Great_tinamou'), siteRecord: BLAKE2021,
  },
  {
    id: 'variegated-tinamou', common: 'Variegated tinamou', scientific: 'Crypturellus variegatus', group: 'bird', body: 'groundbird',
    size: 0.3, colours: [0x8a4a22, 0x2a2018], perch: ['litter'], active: DAY,
    calling: [[17.5, 18.6, 0.8], [5.5, 6.5, 0.9]], callEvery: [14, 26], loudness: [88, 1600], eye: EYE.none(), count: [2, 2],
    fact: 'A tinamou of the terra firme forest floor, counted on the Tiputini study plots. Like all tinamous it is heard far more often than seen.',
    source: wiki('Variegated_tinamou'), siteRecord: BLAKE2015,
  },
  {
    id: 'forest-falcon', common: 'Lined forest falcon', scientific: 'Micrastur gilvicollis', group: 'bird', body: 'songbird',
    size: 0.35, colours: [0x6a6e72, 0xe8e8e8], perch: ['understory', 'midstory'], height: [4, 10], active: [[5.0, 18.5, 1]],
    calling: [[5.0, 5.95, 1]], callEvery: [8, 15], loudness: [92, 1100], eye: EYE.none(), count: [2, 2],
    fact: 'The commonest day-hunting bird of prey in much of the lowland Amazon, yet it does its calling in the dark before dawn.',
    source: wiki('Lined_forest_falcon'), siteRecord: inat('Micrastur gilvicollis'),
  },
  {
    id: 'woodcreeper', common: 'Buff-throated woodcreeper', scientific: 'Xiphorhynchus guttatus', group: 'bird', body: 'songbird',
    size: 0.26, colours: [0x7a4a24, 0xd8b888], perch: ['midstory'], height: [5, 12], active: DAY,
    calling: [[17.6, 18.5, 0.9], [5.5, 6.5, 1]], callEvery: [9, 18], loudness: [90, 2200], eye: EYE.none(), count: [2, 3],
    fact: 'One of the first and last voices of the day: it sings in long bouts at dawn and at dusk.',
    source: wiki('Buff-throated_woodcreeper'), siteRecord: BLAKE2021,
  },
  {
    id: 'antthrush', common: 'Black-faced antthrush', scientific: 'Formicarius analis', group: 'bird', body: 'groundbird',
    size: 0.17, colours: [0x4a3420, 0x18130f], perch: ['litter'], active: DAY,
    calling: [[5.65, 6.5, 0.9], [17.5, 18.3, 0.5]], callEvery: [9, 18], loudness: [86, 2000], eye: EYE.none(), count: [2, 3],
    fact: 'It walks the forest floor like a tiny rail, slow and deliberate with its tail cocked up, flicking leaves aside.',
    source: wiki('Black-faced_antthrush'), siteRecord: BLAKE2015,
  },
  {
    id: 'musician-wren', common: 'Musician wren', scientific: 'Cyphorhinus arada', group: 'bird', body: 'songbird',
    size: 0.125, colours: [0x7a4420, 0xb85a28], perch: ['understory'], height: [0.4, 2], active: DAY,
    calling: [[5.8, 6.5, 0.9]], callEvery: [10, 18], loudness: [84, 2500], eye: EYE.none(), count: [1, 2],
    fact: 'Pairs sing back and forth in clear, haunting whistles. In Brazilian folklore every other bird falls silent when it begins.',
    source: wiki('Musician_wren'), siteRecord: { label: 'xeno-canto XC69827, recorded at Yasuní Research Station', url: 'https://xeno-canto.org/69827' },
  },
  {
    id: 'toucan', common: 'White-throated toucan', scientific: 'Ramphastos tucanus', group: 'bird', body: 'toucan',
    size: 0.55, colours: [0x15130f, 0xf0f0e8], perch: ['canopy'], height: [20, 32], active: DAY,
    calling: [[5.9, 6.5, 1]], callEvery: [9, 16], loudness: [98, 1500], eye: EYE.none(), count: [2, 3],
    fact: 'Its yelping call is among the loudest of any toucan, from a bird whose bill can be 22 cm long.',
    source: wiki('White-throated_toucan'), siteRecord: BLAKE2021,
  },
  {
    id: 'screaming-piha', common: 'Screaming piha', scientific: 'Lipaugus vociferans', group: 'bird', body: 'songbird',
    size: 0.25, colours: [0x7a7a78, 0x8a8a86], perch: ['midstory'], height: [6, 14], active: DAY,
    calling: [[6.0, 6.5, 1]], callEvery: [8, 15], loudness: [108, 2500], eye: EYE.none(), count: [2, 3],
    fact: 'A plain grey bird with a whip-crack voice of more than 110 decibels at one metre, among the loudest of any bird.',
    source: wiki('Screaming_piha'), siteRecord: BLAKE2021,
  },
  {
    id: 'oropendola', common: 'Russet-backed oropendola', scientific: 'Psarocolius angustifrons', group: 'bird', body: 'songbird',
    size: 0.45, colours: [0x5a3a1e, 0xd8c040], perch: ['canopy'], height: [20, 30], active: DAY,
    calling: [[5.9, 6.5, 0.9]], callEvery: [10, 18], loudness: [92, 1500], eye: EYE.none(), count: [2, 3],
    fact: 'Females weave long hanging bag nests from plant fibres. A singing male bows forward, lifts his tail and flaps.',
    source: wiki('Russet-backed_oropendola'), siteRecord: inat('Psarocolius angustifrons'),
  },
  {
    id: 'scarlet-macaw', common: 'Scarlet macaw', scientific: 'Ara macao', group: 'bird', body: 'macaw',
    size: 0.84, colours: [0xc8201a, 0x2a50b8], perch: ['air-river'], height: [22, 30], active: [[5.95, 18.2, 1]],
    calling: [[6.0, 6.5, 1]], callEvery: [7, 13], loudness: [100, 1800], eye: EYE.none(), count: [4, 4],
    fact: 'Macaws fly over the canopy in pairs, and gather at clay licks to eat clay, which is thought to give them sodium and calcium.',
    source: wiki('Scarlet_macaw'), siteRecord: BLAKE2021,
  },

  // ───────────── Mammals ─────────────
  {
    id: 'red-howler', common: 'Colombian red howler', scientific: 'Alouatta seniculus', group: 'mammal', body: 'monkey',
    size: 0.6, colours: [0x9a4a1e, 0x3a2014], perch: ['canopy'], height: [22, 32], active: ALWAYS,
    calling: [[5.25, 6.3, 1]], callEvery: [13, 22], loudness: [104, 400], eye: EYE.none('A monkey of the day: no reflecting layer, no eyeshine.'), count: [3, 4],
    fact: 'The males roar at dawn, and the sound can carry up to 5 kilometres through the forest. At Tiputini the howling is already under way by 05:45.',
    source: wiki('Colombian_red_howler'), siteRecord: BASS2010,
  },
  {
    id: 'titi', common: 'White-tailed titi', scientific: 'Plecturocebus discolor', group: 'mammal', body: 'monkey',
    size: 0.33, colours: [0x8a5a36, 0xe8e0d0], perch: ['midstory'], height: [8, 15], active: ALWAYS,
    calling: [[5.9, 6.5, 1]], callEvery: [14, 24], loudness: [98, 900], eye: EYE.none('A monkey of the day: no reflecting layer, no eyeshine.'), count: [2, 2],
    fact: 'Titi monkeys call in the early morning. The acoustic recorders at Tiputini are used to track where their groups live.',
    source: { label: 'Passive acoustic monitors at Tiputini', url: 'https://sites.google.com/miamioh.edu/passiveacousticmonitorstbs/home' }, siteRecord: inat('Plecturocebus'),
  },
  {
    id: 'night-monkey', common: "Spix's night monkey", scientific: 'Aotus vociferans', group: 'mammal', body: 'monkey',
    size: 0.34, colours: [0x7a7468, 0xf0ece0], perch: ['canopy'], height: [18, 26],
    calling: [[19, 4, 0.4]], callEvery: [26, 50], loudness: [86, 900],
    eye: { reflectance: 0.06, pupilMm: 12, colour: 0xffe0b0, note: 'Sources disagree on whether night monkeys have a tapetum at all: little or no eyeshine is drawn.' }, count: [2, 3],
    fact: 'The only truly nocturnal monkeys in the world. They see no colour at all, and are busiest on moonlit nights.',
    source: wiki('Night_monkey'), siteRecord: inat('Aotus vociferans'),
  },
  {
    id: 'kinkajou', common: 'Kinkajou', scientific: 'Potos flavus', group: 'mammal', body: 'kinkajou',
    size: 0.5, colours: [0xa8783a, 0x6a4a22], perch: ['canopy'], height: [18, 28],
    calling: [[19.5, 4, 0.35]], callEvery: [28, 55], loudness: [88, 2000],
    eye: { reflectance: 0.9, pupilMm: 10, colour: 0xffa63c, note: 'Carnivores have a tapetum (group level). The orange drawn is an assumption.' }, count: [2, 3],
    fact: 'It hangs upside down by its gripping tail and hind feet to feed, and can twist its spine about 180 degrees.',
    source: { label: 'Animal Diversity Web', url: 'https://animaldiversity.org/accounts/Potos_flavus/' }, siteRecord: inat('Potos flavus'),
  },
  {
    id: 'ocelot', common: 'Ocelot', scientific: 'Leopardus pardalis', group: 'mammal', body: 'cat',
    size: 0.8, colours: [0xb8904a, 0xe8dcc0], perch: ['litter'], active: [[18.5, 5.5, 1]],
    eye: EYE.cat(11, 'Its eyes reflect a golden glow at night (species level).'), count: [1, 1],
    fact: 'A cat of dusk and night. Its brown eyes reflect a golden glow when a light catches them.',
    source: wiki('Ocelot'), siteRecord: inat('Leopardus pardalis'),
  },
  {
    id: 'jaguar', common: 'Jaguar', scientific: 'Panthera onca', group: 'mammal', body: 'cat',
    size: 1.5, colours: [0xc89a3c, 0xe8dcc0], perch: ['litter'], active: ALWAYS,
    eye: EYE.cat(14, 'Big cats: golden to coppery yellow eyeshine (group level).'), count: [1, 1],
    fact: 'It has the third most powerful bite of any cat, after the tiger and the lion. It saw you long before you saw it.',
    source: wiki('Jaguar'), siteRecord: BASS2010, iucn: 'Near Threatened',
  },
  {
    id: 'paca', common: 'Lowland paca', scientific: 'Cuniculus paca', group: 'mammal', body: 'rodent',
    size: 0.7, colours: [0x5a3a22, 0xe8e0d0], perch: ['litter', 'stream'],
    eye: EYE.red(9, 'Rodents: red eyeshine (group level).'), count: [2, 3],
    fact: 'Its cheekbones are hollowed into echo chambers that make its growl louder, a feature found in no other mammal.',
    source: wiki('Lowland_paca'), siteRecord: inat('Cuniculus paca'),
  },
  {
    id: 'tapir', common: 'South American tapir', scientific: 'Tapirus terrestris', group: 'mammal', body: 'tapir',
    size: 2.0, colours: [0x3a3028, 0xe8e8e0], perch: ['riverbank', 'stream'], active: [[18.5, 5.5, 1]],
    eye: { reflectance: 0.5, pupilMm: 12, colour: 0xcfe8dc, note: 'A tapetum is expected (its relatives the horses have one), but no source gives the colour. A pale shine is drawn.' }, count: [1, 1],
    fact: 'The largest surviving native land mammal in the Amazon: about 225 kg of animal that moves through the forest almost silently.',
    source: wiki('South_American_tapir'), siteRecord: BASS2010, iucn: 'Vulnerable',
  },
  {
    id: 'opossum', common: 'Common opossum', scientific: 'Didelphis marsupialis', group: 'mammal', body: 'opossum',
    size: 0.4, colours: [0x4a443c, 0xe8e0d0], perch: ['litter', 'log'], active: [[19, 4.5, 1]],
    eye: EYE.red(8, 'Opossums: red eyeshine (group level).'), count: [2, 3],
    fact: 'Busiest in the dead of night, between 11 pm and 3 am. When frightened, it plays dead.',
    source: wiki('Common_opossum'), siteRecord: inat('Didelphis marsupialis'),
  },
  {
    id: 'armadillo', common: 'Nine-banded armadillo', scientific: 'Dasypus novemcinctus', group: 'mammal', body: 'armadillo',
    size: 0.45, colours: [0x6a6258, 0x4a443c], perch: ['litter'], eye: EYE.none('No eyeshine could be sourced, so none is drawn.'), count: [1, 2],
    fact: 'Every litter is four identical quadruplets, grown from one single egg.',
    source: wiki('Nine-banded_armadillo'), siteRecord: inat('Dasypus novemcinctus'),
  },
  {
    id: 'fruit-bat', common: 'Chestnut short-tailed bat', scientific: 'Carollia castanea', group: 'mammal', body: 'bat',
    size: 0.3, colours: [0x5a4030, 0x2a2018], perch: ['air'], height: [1.5, 6],
    silentNote: 'Bats find their way with calls pitched far above human hearing. It passes you in silence.',
    eye: EYE.none('Too small and fast for eyeshine to be seen.'), count: [6, 8],
    fact: 'A small fruit bat of the understory. It calls constantly as it flies, at pitches far too high for you to hear.',
    source: wiki('Chestnut_short-tailed_bat'), siteRecord: inat('Carollia castanea'),
  },

  // ───────────── Spiders, insects and their kin ─────────────
  {
    id: 'wandering-spider', common: 'Amazonian wandering spider', scientific: 'Phoneutria fera', group: 'invertebrate', body: 'spider',
    size: 0.13, colours: [0x6a5a40, 0x4a3c2a], perch: ['litter', 'understory'], height: [0, 1.2], eye: EYE.spider(0.9), count: [8, 12],
    fact: 'Young spiders live up in the vegetation. As they grow they move down and hunt on the forest floor, without a web.',
    source: wiki('Phoneutria_fera'), siteRecord: inat('Phoneutria fera'), iucn: 'Not evaluated',
  },
  {
    id: 'small-wandering-spiders', common: 'Wandering spiders', scientific: 'family Ctenidae', group: 'invertebrate', body: 'spider',
    size: 0.035, colours: [0x5a4a36, 0x3a3024], perch: ['litter'], eye: EYE.spider(0.45), count: [170, 210],
    fact: 'The glitter on the forest floor is spiders. Each green spark is your own torch, sent back by the mirror behind a hunting spider’s eyes.',
    source: wiki('Tapetum_lucidum'), siteRecord: inat('Phoneutria'), iucn: 'Not evaluated',
  },
  {
    id: 'fishing-spider', common: 'Giant fishing spider', scientific: 'Ancylometes rufus', group: 'invertebrate', body: 'spider',
    size: 0.2, colours: [0x6a3a22, 0x4a2a1a], perch: ['stream'], eye: EYE.spider(1.1), count: [3, 5],
    fact: 'It walks on water, dives for small fish, and can stay under for over an hour on air trapped in its body hairs.',
    source: wiki('Ancylometes'), siteRecord: inat('Ancylometes rufus'), iucn: 'Not evaluated',
  },
  {
    id: 'pinktoe-tarantula', common: 'Amazonian pinktoe tarantula', scientific: 'Avicularia juruensis', group: 'invertebrate', body: 'spider',
    size: 0.13, colours: [0x1e1a1a, 0x2a2626], perch: ['trunk'], height: [1, 3],
    eye: EYE.none('No eyeshine could be sourced for tarantulas, so none is drawn.'), count: [3, 4],
    fact: 'A tarantula that lives in trees and spins a silk tube to hide in. One was once seen eating a small bat on a palm trunk.',
    source: wiki('Avicularia_juruensis'), siteRecord: inat('Avicularia juruensis'), iucn: 'Not evaluated',
  },
  {
    id: 'whip-spider', common: 'Tailless whip scorpion', scientific: 'Heterophrynus batesii', group: 'invertebrate', body: 'whipspider',
    size: 0.3, colours: [0x2a221c, 0x3a3028], perch: ['trunk'], height: [0.3, 2.5], eye: EYE.none(), count: [4, 6],
    fact: 'Neither spider nor scorpion, and harmless to you. Its first pair of legs have become long feelers that it uses to find its way in the dark.',
    source: wiki('Amblypygi'), siteRecord: inat('Heterophrynus batesii'), iucn: 'Not evaluated',
  },
  {
    id: 'bullet-ant', common: 'Bullet ant', scientific: 'Paraponera clavata', group: 'invertebrate', body: 'ant',
    size: 0.025, colours: [0x2a1410, 0x3a1c14], perch: ['trunk'], height: [0.2, 1.5], eye: EYE.none(), count: [8, 12],
    fact: 'An ant up to 3 cm long that nests at the foot of a tree and climbs all the way to the canopy for nectar.',
    source: wiki('Paraponera_clavata'), siteRecord: inat('Paraponera clavata'), iucn: 'Not evaluated',
  },
  {
    id: 'leafcutter-ants', common: 'Leafcutter ants', scientific: 'Atta cephalotes', group: 'invertebrate', body: 'ants',
    size: 3.3, colours: [0x6a2c14, 0x4a9a3a], perch: ['litter'], active: ALWAYS, eye: EYE.none(), count: [3, 4],
    fact: 'These ants are farmers. They carry pieces of leaf home to feed a fungus garden, in colonies of up to 5 million.',
    source: wiki('Atta_cephalotes'), siteRecord: inat('Atta cephalotes'), iucn: 'Not evaluated',
  },
  {
    id: 'owl-butterfly', common: 'Owl butterfly', scientific: 'Caligo eurilochus', group: 'invertebrate', body: 'butterfly',
    size: 0.15, colours: [0x5a4630, 0xe8c040], perch: ['trunk'], height: [0.8, 2.5], active: ALWAYS, eye: EYE.none('The “eye” is a pattern on the wing. It does not shine.'), count: [3, 4],
    fact: 'One of the largest butterflies of its family, up to 17 cm across, with an owl’s eye painted on each hindwing.',
    source: wiki('Caligo_eurilochus'), siteRecord: inat('Caligo eurilochus'), iucn: 'Not evaluated',
  },
  {
    id: 'katydids', common: 'Katydids', scientific: 'family Tettigoniidae', group: 'invertebrate', body: 'beetle',
    size: 0.05, colours: [0x3f8a3a, 0x5aa04a], perch: ['understory'], height: [0.5, 4],
    calling: [[18.5, 5.3, 1]], callEvery: [0, 0], loudness: [80, 8000],
    synth: { recipe: 'f0=7800,f1=8600,pulses=4,rate=11,duty=0.45,noise=0.75,am=140,gap=0.9,repeats=3', note: 'Synthesised: a generic katydid song, not a named species.' },
    eye: EYE.none(), count: [30, 40],
    fact: 'Most of the high, dry ticking of the night is katydids rubbing one wing against the other. Which species sing here was not established for this build.',
    source: wiki('Tettigoniidae'), siteRecord: BASS2010, iucn: 'Not evaluated',
  },
  {
    id: 'crickets', common: 'Crickets', scientific: 'superfamily Grylloidea', group: 'invertebrate', body: 'beetle',
    size: 0.02, colours: [0x2a2018, 0x3a2c20], perch: ['litter'],
    calling: [[18.3, 5.5, 0.9]], callEvery: [0, 0], loudness: [76, 4800],
    synth: { recipe: 'f0=4700,f1=4850,pulses=3,rate=26,duty=0.6,gap=0.42,repeats=5', note: 'Synthesised: a generic cricket chirp, not a named species.' },
    eye: EYE.none(), count: [34, 44],
    fact: 'A cricket sings by drawing a scraper on one wing across a file of teeth on the other. The steady, pure chirps underfoot are theirs.',
    source: wiki('Cricket_(insect)'), siteRecord: BASS2010, iucn: 'Not evaluated',
  },
  {
    id: 'cicadas', common: 'Cicadas', scientific: 'family Cicadidae', group: 'invertebrate', body: 'beetle',
    size: 0.045, colours: [0x3a4a2a, 0x5a5a3a], perch: ['midstory'], height: [6, 14], active: ALWAYS,
    calling: [[17.6, 18.55, 1], [5.75, 6.5, 0.55]], callEvery: [0, 0], loudness: [96, 5500],
    synth: { recipe: 'f0=5300,f1=5700,pulses=1,rate=0.14,duty=0.86,noise=0.8,am=190,gap=1.2', note: 'Synthesised: a generic cicada buzz, not a named species.' },
    eye: EYE.none(), count: [9, 12],
    fact: 'Cicadas are among the loudest insects on Earth. Their chorus swells as the light goes, and it is the sound of dusk here.',
    source: wiki('Cicada'), siteRecord: BASS2010, iucn: 'Not evaluated',
  },
  {
    id: 'fireflies', common: 'Fireflies', scientific: 'family Lampyridae', group: 'invertebrate', body: 'firefly',
    size: 0.012, colours: [0x2a2018, 0x4a3a20], perch: ['air'], height: [0.6, 6], active: [[18.4, 22, 1], [22, 5, 0.3]],
    eye: EYE.none(), glow: { colour: 0xd4ff6a, pattern: 'flash', strength: 1, note: 'Fireflies make cold light in their abdomen to signal to each other.' }, count: [70, 90],
    fact: 'Each flash is a signal to other fireflies. Your torch drowns them out: switch it off and wait for your eyes.',
    source: wiki('Firefly'), siteRecord: BASS2010, iucn: 'Not evaluated',
  },

  // ───────────── Fungi ─────────────
  {
    id: 'glowing-litter', common: 'Glowing leaf litter', scientific: 'Mycena sp. (not yet described)', group: 'fungus', body: 'fungus',
    size: 0.7, colours: [0x3a2c1c, 0x4a3a26], perch: ['litter'], active: ALWAYS, eye: EYE.none(),
    glow: { colour: 0x7dffa4, pattern: 'steady', strength: 0.55, note: 'The threads of the fungus glow green inside the dead leaves.' }, count: [30, 38],
    fact: 'At Yasuní the dead leaves themselves glow: a fungus not yet named threads through the litter and shines green. Disturbing the leaves makes it brighter, peaking about three hours later.',
    source: BLANCHETTE, siteRecord: BLANCHETTE, iucn: 'Not evaluated',
  },
];

export const SPECIES: readonly Species[] = rows.map(make);
export const SPECIES_BY_ID: ReadonlyMap<string, Species> = new Map(SPECIES.map((s) => [s.id, s] as const));

/** Facts about the place, each with its source. Shown in the notebook and the README. */
export const PLACE = {
  name: 'Tiputini Biodiversity Station, Yasuní, Ecuador',
  coordinates: '0°37′S 76°10′W',
  elevation: '190–270 m',
  facts: [
    { text: '150 species of amphibian are known from Yasuní, the most recorded for any place of its size.', source: BASS2010 },
    { text: 'A single hectare of this forest holds more than 655 species of tree.', source: BASS2010 },
    { text: '105 amphibian and 80 reptile species are recorded at Tiputini station itself; 68% of its frogs were found at night.', source: CH2003 },
    { text: '596 bird species are documented in Yasuní.', source: BASS2010 },
  ],
} as const;
