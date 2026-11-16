import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstOnsetAfter, strengthAt } from '../src/core/activity.ts';
import { RECORDINGS } from '../src/core/recordings.ts';
import { SPECIES, SPECIES_BY_ID } from '../src/core/species.ts';
import { NIGHT_SECONDS } from '../src/core/time.ts';
import { PERCH_HEIGHT, SITE, distanceToStream, generateWorld, treeHeight } from '../src/core/world.ts';

const world = generateWorld(7, SPECIES);

describe('determinism', () => {
  it('builds the same night from the same number', () => {
    const again = generateWorld(7, SPECIES);
    expect(again.trees).toEqual(world.trees);
    expect(again.animals).toEqual(world.animals);
    expect(again.events).toEqual(world.events);
    expect(again.plants.length).toBe(world.plants.length);
  });
  it('builds a different night from a different number', () => {
    const other = generateWorld(8, SPECIES);
    expect(other.trees[0]).not.toEqual(world.trees[0]);
    expect(other.animals.map((a) => a.x)).not.toEqual(world.animals.map((a) => a.x));
    expect(other.events).not.toEqual(world.events);
  });
});

describe('forest structure', () => {
  const landHa = (SITE.half * 2 * (SITE.half - SITE.riverZ)) / 10000;
  it('holds about 702 trees per hectare of land, the count in the Yasuní plot', () => {
    const perHa = world.trees.length / landHa;
    expect(perHa).toBeGreaterThan(640);
    expect(perHa).toBeLessThanOrEqual(702.5);
  });
  it('follows the western Amazon height curve', () => {
    expect(treeHeight(10)).toBeCloseTo(13.8, 0);
    expect(treeHeight(60)).toBeCloseTo(30.1, 0);
    expect(treeHeight(200)).toBeLessThan(46.3);
  });
  it('has many thin stems, a closed canopy, and emergents of 40 to 50 m', () => {
    const emergents = world.trees.filter((t) => t.kind === 'emergent');
    expect(emergents.length).toBeGreaterThan(5);
    for (const t of emergents) {
      expect(t.height).toBeGreaterThanOrEqual(40);
      expect(t.height).toBeLessThanOrEqual(50);
    }
    const thin = world.trees.filter((t) => t.dbh < 0.2).length / world.trees.length;
    expect(thin).toBeGreaterThan(0.55);
    const tall = world.trees.filter((t) => t.height > 22 && t.kind !== 'emergent');
    expect(tall.length).toBeGreaterThan(100);
  });
  it('keeps trees out of the river and the stream, and off each other', () => {
    for (const t of world.trees) {
      expect(t.z).toBeGreaterThan(SITE.riverZ);
      expect(distanceToStream(t.x, t.z)).toBeGreaterThan(2);
    }
    const sample = world.trees.slice(0, 400);
    for (let i = 0; i < sample.length; i++)
      for (let j = i + 1; j < sample.length; j++) {
        const a = sample[i]!;
        const b = sample[j]!;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan((a.dbh + b.dbh) / 2);
      }
  });
  it('makes about one tree in ten a stilt palm, as in the plot', () => {
    const palms = world.trees.filter((t) => t.kind === 'palm');
    const share = palms.length / world.trees.length;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.125);
    for (const p of palms) expect(p.dbh).toBeLessThan(0.25);
  });
});

describe('where animals sit', () => {
  it('places every species at least once', () => {
    const present = new Set(world.animals.map((a) => a.species));
    for (const sp of SPECIES) expect(present.has(sp.id), sp.id).toBe(true);
  });
  it('keeps each animal within the height its perch and its species allow', () => {
    for (const a of world.animals) {
      const sp = SPECIES_BY_ID.get(a.species)!;
      expect(sp.perch).toContain(a.perch);
      if (a.perch === 'riverbank') continue; // sits on the bank or the waterline, whichever is higher
      const tree = a.tree >= 0 ? world.trees[a.tree]! : null;
      const ground = a.perch === 'water' || a.perch === 'air-river' ? SITE.waterY : tree ? world.heightAt(tree.x, tree.z) : world.heightAt(a.x, a.z);
      const above = a.y - ground;
      const [lo, hi] = PERCH_HEIGHT[a.perch];
      expect(above, `${a.species} on ${a.perch}`).toBeGreaterThanOrEqual(Math.max(lo, 0) - 0.01);
      expect(above, `${a.species} on ${a.perch}`).toBeLessThanOrEqual(Math.max(hi, sp.height[1]) + 0.9);
    }
  });
  it('puts water animals in the river, stream animals by the stream, and nothing where you start', () => {
    for (const a of world.animals) {
      if (a.perch === 'water') expect(a.z).toBeLessThan(SITE.riverZ);
      if (a.perch === 'stream') expect(distanceToStream(a.x, a.z)).toBeLessThan(2.5);
      if (a.perch === 'riverbank') expect(a.z).toBeLessThan(SITE.riverZ + 5);
      if (a.perch !== 'air' && a.perch !== 'air-river') expect(Math.hypot(a.x - SITE.start.x, a.z - SITE.start.z)).toBeGreaterThan(2);
    }
  });
  it('puts tree animals on trees tall enough to hold them', () => {
    for (const a of world.animals) {
      if (a.perch !== 'canopy' && a.perch !== 'midstory') continue;
      const t = world.trees[a.tree]!;
      expect(a.y - world.heightAt(t.x, t.z)).toBeLessThan(t.height);
    }
  });
  it('gives the first goal a potoo to find', () => {
    expect(world.questAnimal).toBeGreaterThanOrEqual(0);
    expect(world.animals[world.questAnimal]!.species).toBe('common-potoo');
  });
});

describe('who is out, and when', () => {
  const out = (id: string, hour: number) => strengthAt(SPECIES_BY_ID.get(id)!.active, hour);
  const calls = (id: string, hour: number) => strengthAt(SPECIES_BY_ID.get(id)!.calling, hour);
  const onset = (id: string) => firstOnsetAfter(SPECIES_BY_ID.get(id)!.calling, 4.6)!;
  it('keeps night animals for the night and day animals for the edges', () => {
    for (const id of ['common-potoo', 'kinkajou', 'smoky-jungle-frog', 'amazon-tree-boa', 'opossum']) {
      expect(out(id, 23), id).toBe(1);
      expect(out(id, 12), id).toBe(0);
    }
    for (const id of ['great-tinamou', 'toucan', 'ecuador-poison-frog', 'scarlet-macaw']) {
      expect(out(id, 23), id).toBe(0);
      expect(out(id, 6.3), id).toBeGreaterThan(0.9);
    }
  });
  it('has the howlers roaring before sunrise and by 05:45, as recorded at Tiputini', () => {
    expect(calls('red-howler', 5.75)).toBe(1);
    expect(onset('red-howler')).toBeLessThan(6.0);
    expect(calls('red-howler', 23)).toBe(0);
  });
  it('has the screech owl still calling at 05:45', () => {
    expect(calls('screech-owl', 5.75)).toBeGreaterThan(0);
  });
  it('lets the forest falcon call in the dark before dawn and stop when the day birds start', () => {
    expect(calls('forest-falcon', 5.3)).toBe(1);
    expect(calls('forest-falcon', 6.3)).toBe(0);
  });
  it('orders the dawn: falcon, howler, woodcreeper, then toucan, piha and macaws', () => {
    expect(onset('forest-falcon')).toBeLessThan(onset('red-howler'));
    expect(onset('red-howler')).toBeLessThan(onset('woodcreeper'));
    expect(onset('woodcreeper')).toBeLessThan(onset('toucan'));
    expect(onset('toucan')).toBeLessThanOrEqual(onset('screaming-piha'));
    expect(onset('great-tinamou')).toBeLessThan(onset('scarlet-macaw'));
  });
  it('gives the dusk to tinamous and cicadas, and the night to frogs', () => {
    expect(calls('great-tinamou', 18)).toBe(1);
    expect(calls('cicadas', 18)).toBe(1);
    expect(calls('cicadas', 23)).toBe(0);
    expect(calls('smoky-jungle-frog', 20)).toBe(1);
    expect(calls('smoky-jungle-frog', 12)).toBe(0);
  });
  it('has a lull before first light: fewer voices at 04:15 than at 20:30 or 06:10', () => {
    const count = (h: number) => SPECIES.filter((s) => strengthAt(s.calling, h) >= 0.5).length;
    expect(count(4.25)).toBeLessThan(count(20.5));
    expect(count(4.25)).toBeLessThan(count(6.17));
  });
});

describe('honesty checks on the species table', () => {
  it('has unique ids, a fact, a source and a site record for every entry', () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    for (const s of SPECIES) {
      expect(s.fact.length, s.id).toBeGreaterThan(30);
      expect(s.source.url, s.id).toMatch(/^https:\/\//);
      expect(s.siteRecord.url, s.id).toMatch(/^https:\/\//);
      expect(s.count[0], s.id).toBeGreaterThan(0);
    }
  });
  it('gives no eyeshine to animals without a reflecting layer', () => {
    for (const id of ['red-howler', 'titi', 'toucan', 'great-tinamou', 'scarlet-macaw']) expect(SPECIES_BY_ID.get(id)!.eye.reflectance).toBe(0);
    expect(SPECIES_BY_ID.get('night-monkey')!.eye.reflectance).toBeLessThan(0.1);
  });
  it('never gives a voice to a species without a recording or a declared synthesis', () => {
    for (const s of SPECIES) {
      if (s.voice.kind === 'silent') expect(s.calling.length, s.id).toBe(0);
      if (s.voice.kind === 'recording') expect(RECORDINGS[s.id], s.id).toBeDefined();
      if (s.voice.kind === 'synth') expect(s.voice.note, s.id).toMatch(/Synthesised/);
    }
  });
  it('has every recording on disk and credited in the sources list', () => {
    const sources = JSON.parse(readFileSync('audio/sources.json', 'utf8')) as Array<{ species: string; licence: string; recordist: string; xc: string }>;
    for (const [id, rec] of Object.entries(RECORDINGS)) {
      expect(SPECIES_BY_ID.has(id), id).toBe(true);
      expect(existsSync(`public/audio/${rec.file}`), rec.file).toBe(true);
      const src = sources.find((s) => s.species === id)!;
      expect(src, id).toBeDefined();
      expect(src.licence, id).not.toMatch(/ND/);
      expect(rec.credit).toContain(src.recordist);
      expect(rec.credit).toContain(src.xc);
    }
  });
});

describe('the events of the night', () => {
  it('fit inside the night, in order, with rain before the hush', () => {
    const e = world.events;
    for (let i = 1; i < e.length; i++) expect(e[i]!.at).toBeGreaterThanOrEqual(e[i - 1]!.at);
    for (const ev of e) {
      expect(ev.at).toBeGreaterThan(60);
      expect(ev.at + ev.duration).toBeLessThan(NIGHT_SECONDS - 100);
    }
    const rain = e.find((x) => x.kind === 'rain')!;
    const hush = e.find((x) => x.kind === 'hush')!;
    expect(hush.at).toBeGreaterThan(rain.at + rain.duration);
  });
});
