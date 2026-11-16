import './style.css';
import { nightNumberFor } from './core/rng.ts';
import { PLACE, SPECIES } from './core/species.ts';
import { formatClock } from './core/time.ts';
import type { Group, Species } from './core/types.ts';
import { COUNT_GOAL, GOALS, Game, type GoalId, type Quality } from './game.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const night = Math.max(1, Math.floor(Number(params.get('night')) || nightNumberFor(new Date())));
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(innerWidth, innerHeight) < 600;
const quality: Quality =
  coarse || small
    ? { plants: 0.5, steps: 8, maxDpr: 1.25, motes: 140, rain: 700, lowPower: true }
    : { plants: 1, steps: 14, maxDpr: 1.5, motes: 280, rain: 1600, lowPower: false };

$('night-label').textContent = `Night ${night}`;
$('book-night').textContent = `Night ${night}`;

const GROUP_TITLES: Record<Group, string> = {
  frog: 'Frogs and toads',
  reptile: 'Snakes and caimans',
  bird: 'Birds',
  mammal: 'Mammals',
  invertebrate: 'Spiders, insects and their kin',
  fungus: 'Fungi',
};
const KIND: Record<Group, string> = { frog: 'Frog', reptile: 'Reptile', bird: 'Bird', mammal: 'Mammal', invertebrate: 'Invertebrate', fungus: 'Fungus' };

let whisperTimer = 0;
const whisperQueue: string[] = [];
let whispering = false;
function whisper(text: string, hold = 6500): void {
  whisperQueue.push(text);
  if (whispering) return;
  const next = () => {
    const t = whisperQueue.shift();
    if (!t) {
      whispering = false;
      return;
    }
    whispering = true;
    const el = $('whisper');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(whisperTimer);
    whisperTimer = window.setTimeout(() => {
      el.classList.remove('on');
      window.setTimeout(next, 2000);
    }, hold);
  };
  next();
}

let cardTimer = 0;
function showCard(sp: Species, total: number): void {
  $('card-kind').textContent = `${KIND[sp.group]} · ${sp.iucn}`;
  $('card-name').textContent = sp.common;
  $('card-sci').textContent = sp.scientific;
  $('card-fact').textContent = sp.fact;
  $('card-eye').textContent = sp.glow ? sp.glow.note : sp.eye.note;
  $('card-count').textContent = `${total} of ${SPECIES.length} found`;
  const a = $<HTMLAnchorElement>('card-source');
  a.textContent = sp.source.label;
  a.href = sp.source.url;
  const card = $('card');
  card.hidden = true;
  void card.offsetWidth;
  card.hidden = false;
  clearTimeout(cardTimer);
  cardTimer = window.setTimeout(() => (card.hidden = true), 11000);
}

let heardTimer = 0;
function showHeard(sp: Species): void {
  const el = $('heard');
  el.textContent = `You hear: ${sp.common.toLowerCase()}`;
  el.classList.add('on');
  clearTimeout(heardTimer);
  heardTimer = window.setTimeout(() => el.classList.remove('on'), 5000);
}

const goalOrder: GoalId[] = ['potoo', 'dark', 'river', 'count'];
let goalsRest = 0;
function renderGoals(game: Game): void {
  const ul = $('goals');
  ul.innerHTML = '';
  for (const id of goalOrder) {
    const li = document.createElement('li');
    li.textContent = game.goals.has(id) ? GOALS[id].done : id === 'count' ? `${GOALS[id].text} (${Math.min(game.found.size, COUNT_GOAL)}/${COUNT_GOAL})` : GOALS[id].text;
    if (game.goals.has(id)) li.className = 'done';
    ul.append(li);
  }
  ul.classList.remove('rest');
  clearTimeout(goalsRest);
  goalsRest = window.setTimeout(() => ul.classList.add('rest'), 9000);
}

const PHASE_LINES: Record<string, string> = {
  dusk: 'The light is going. The day shift is leaving.',
  'early night': 'Night. Now the frogs.',
  'deep night': 'The deep of the night. Fewer voices, larger ones.',
  'the lull': 'The hour before first light. Even the frogs are tired.',
  'first light': 'Somewhere above the canopy, the sky has begun.',
  'dawn chorus': 'Dawn.',
};

const game = new Game($<HTMLCanvasElement>('stage'), night, quality, {
  onFound(sp, total) {
    showCard(sp, total);
    renderGoals(game);
  },
  onHeard: showHeard,
  onGoal(id) {
    whisper(GOALS[id].done, 4500);
    renderGoals(game);
  },
  onPhase(phase) {
    $('clock-phase').textContent = phase;
    whisper(PHASE_LINES[phase] ?? '', 5000);
  },
  onWhisper: (t) => whisper(t, 3500),
  onFocus(p) {
    const r = $('reticle');
    r.classList.toggle('on', p > 0);
    r.style.setProperty('--p', String(p));
  },
  onEnd() {
    const seen = game.found.size;
    const heardOnly = [...game.heard].filter((id) => !game.found.has(id)).length;
    $('end-sum').textContent =
      `You met ${seen} of the forest’s animals. ${heardOnly} more you heard and never saw. ` +
      `${SPECIES.length - seen - heardOnly} were there all night and never let you know.`;
    document.exitPointerLock?.();
    window.setTimeout(() => {
      $('end').hidden = false;
      $('hud').hidden = true;
    }, 6000);
  },
});

setInterval(() => {
  if (game.running) $('clock-time').textContent = formatClock(game.hour);
}, 500);

// ───── Notebook ─────
function openBook(): void {
  const seen = game.found.size;
  $('book-sum').textContent = `${seen} met, ${[...game.heard].filter((id) => !game.found.has(id)).length} only heard, of ${SPECIES.length} species and groups placed in this night. An animal you have not met keeps its name.`;
  const list = $('book-list');
  list.innerHTML = '';
  for (const group of Object.keys(GROUP_TITLES) as Group[]) {
    const h = document.createElement('h3');
    h.textContent = GROUP_TITLES[group];
    list.append(h);
    for (const sp of SPECIES.filter((s) => s.group === group)) {
      const seenIt = game.found.has(sp.id);
      const heardIt = game.heard.has(sp.id);
      const div = document.createElement('div');
      div.className = `entry ${seenIt ? 'seen' : heardIt ? 'heard' : 'unknown'}`;
      const voice =
        sp.voice.kind === 'recording' ? `Voice: ${sp.voice.credit}.` : sp.voice.kind === 'synth' ? sp.voice.note : sp.calling.length || sp.voice.note ? sp.voice.note : '';
      div.innerHTML = seenIt
        ? `<span class="mark">Met</span><div><h4>${sp.common}<i>${sp.scientific}</i></h4><p>${sp.fact}</p>
           <span class="where">${sp.glow ? sp.glow.note : sp.eye.note} ${voice}<br>Fact: <a href="${sp.source.url}" target="_blank" rel="noopener">${sp.source.label}</a> · Recorded here: <a href="${sp.siteRecord.url}" target="_blank" rel="noopener">${sp.siteRecord.label}</a></span></div>`
        : heardIt
          ? `<span class="mark">Heard</span><div><h4>${sp.common}<i>${sp.scientific}</i></h4><span class="where">You have heard it. You have not seen it. ${voice}</span></div>`
          : `<span class="mark">—</span><div><h4>Not yet met</h4></div>`;
      list.append(div);
    }
  }
  $('book-place').innerHTML =
    `<h3>The place</h3><p>${PLACE.name}. ${PLACE.coordinates}, ${PLACE.elevation} above the sea.</p>` +
    PLACE.facts.map((f) => `<p>${f.text} <a href="${f.source.url}" target="_blank" rel="noopener">${f.source.label}</a></p>`).join('');
  $('notebook').hidden = false;
  document.exitPointerLock?.();
  setPaused();
}
function closeBook(): void {
  $('notebook').hidden = true;
  $('paused').hidden = coarse || !game.running || !$('end').hidden;
  setPaused();
}
$('book-close').onclick = closeBook;
$('btn-book').onclick = openBook;
$('end-book').onclick = openBook;
$('end-again').onclick = () => {
  const u = new URL(location.href);
  u.searchParams.set('night', String(night + 1));
  location.href = u.toString();
};

function setPaused(): void {
  const p = !$('notebook').hidden || (!coarse && game.running && document.pointerLockElement !== $('stage') && $('end').hidden === true);
  game.paused = p;
  game.sound.setPaused(p || document.hidden);
}

const lock = () => {
  try {
    const p = $('stage').requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  } catch {
    // Pointer lock is a comfort, not a requirement.
  }
};

// ───── Controls ─────
const canvas = $<HTMLCanvasElement>('stage');
const keys = new Set<string>();
function readKeys(): void {
  game.move.x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  game.move.y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  game.move.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  readKeys();
  if (!game.running) return;
  if (e.code === 'KeyF' || e.code === 'Space') {
    game.toggleTorch();
    e.preventDefault();
  }
  if (e.code === 'KeyN' || e.code === 'Tab') {
    e.preventDefault();
    if ($('notebook').hidden) openBook();
    else closeBook();
  }
  if (e.code === 'Escape') closeBook();
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  readKeys();
});
addEventListener('blur', () => {
  keys.clear();
  readKeys();
});

if (!coarse) {
  canvas.addEventListener('click', () => {
    if (!game.running) return;
    if (document.pointerLockElement === canvas) game.toggleTorch();
    else lock();
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    $('paused').hidden = locked || !game.running || !$('notebook').hidden || !$('end').hidden;
    setPaused();
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) game.look(e.movementX * 0.0022, e.movementY * 0.0022);
  });
} else {
  $('touch').hidden = false;
  $('btn-torch').onclick = () => game.toggleTorch();
  const stick = $('stick');
  const knob = stick.firstElementChild as HTMLElement;
  let moveId = -1;
  let lookId = -1;
  let ox = 0;
  let oy = 0;
  let lx = 0;
  let ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.clientX < innerWidth * 0.45 && moveId < 0) {
      moveId = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      stick.style.left = `${ox}px`;
      stick.style.top = `${oy}px`;
      stick.classList.add('on');
    } else if (lookId < 0) {
      lookId = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === moveId) {
      const dx = Math.max(-52, Math.min(52, e.clientX - ox));
      const dy = Math.max(-52, Math.min(52, e.clientY - oy));
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      game.move.x = dx / 52;
      game.move.y = -dy / 52;
      game.move.run = false;
    } else if (e.pointerId === lookId) {
      game.look((e.clientX - lx) * 0.005, (e.clientY - ly) * 0.005);
      lx = e.clientX;
      ly = e.clientY;
    }
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId === moveId) {
      moveId = -1;
      game.move.x = game.move.y = 0;
      knob.style.transform = '';
      stick.classList.remove('on');
    }
    if (e.pointerId === lookId) lookId = -1;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

// ───── Begin ─────
$('begin').onclick = async () => {
  $('title').classList.add('gone');
  window.setTimeout(() => ($('title').hidden = true), 2600);
  $('hud').hidden = false;
  if (!coarse) lock();
  await game.begin();
  renderGoals(game);
  window.setTimeout(() => whisper('You have one torch. Everything else out here can see in the dark.', 6000), 2500);
};

document.addEventListener('visibilitychange', () => game.sound.setPaused(document.hidden));

if (params.has('debug')) {
  (window as unknown as { game: Game }).game = game;
  game.autoQuality = false;
  const t = Number(params.get('t'));
  if (t) game.debug.setTime(t);
  const speed = Number(params.get('speed'));
  if (speed) game.timeScale = speed;
}
