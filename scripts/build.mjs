// Builds data/vines.json: the guess dictionaries and every puzzle for each mode.
//
//   node scripts/build.mjs
//
// Guesses are checked against ENABLE (downloaded once into scripts/.cache).
// Answers come from scripts/targets.txt: common 6- to 9-letter words with no
// repeated letter. Each mode adds 0, 1 or 2 decoy letters to the ring, picked
// so the decoys turn up in plenty of 5-letter words (so they aren't obvious)
// and, where possible, leave other words of the answer's length on the ring.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cache = path.join(here, '.cache');
const enablePath = path.join(cache, 'enable.txt');

if (!fs.existsSync(enablePath)) {
  fs.mkdirSync(cache, { recursive: true });
  const res = await fetch('https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt');
  fs.writeFileSync(enablePath, await res.text());
}

const enable = fs.readFileSync(enablePath, 'utf8').split(/\r?\n/).filter(w => /^[a-z]+$/.test(w));
const five = enable.filter(w => w.length === 5);
// Answer guesses: any 6- to 9-letter word with no repeated letter.
const long = enable.filter(w => w.length >= 6 && w.length <= 9 && new Set(w).size === w.length);
const targets = fs.readFileSync(path.join(here, 'targets.txt'), 'utf8').split(/\r?\n/).filter(Boolean);

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rand() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const spellable = (w, set) => { for (const c of w) if (!set.has(c)) return false; return true; };
const alphabet = 'abcdefghijklmnopqrstuvwxyz';

function pickDecoys(target, count, rand) {
  if (count === 0) return [];
  const own = new Set(target);
  const spare = [...alphabet].filter(c => !own.has(c) && !'jqxz'.includes(c));
  const combos = count === 1 ? spare.map(c => [c]) : spare.flatMap((a, i) => spare.slice(i + 1).map(b => [a, b]));
  const scored = [];
  for (const d of combos) {
    const ring = new Set([...own, ...d]);
    const probes = five.filter(w => spellable(w, ring));
    // Each decoy has to appear in several playable words.
    const perDecoy = d.map(c => probes.filter(w => w.includes(c)).length);
    if (Math.min(...perDecoy) < 6) continue;
    const answers = long.filter(w => w.length === target.length && spellable(w, ring)).length;
    scored.push({ d, score: Math.min(...perDecoy) + 4 * Math.min(answers, 12) });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(3, Math.ceil(scored.length / 4)));
  return top[rand() * top.length | 0].d;
}

const modes = { sprout: 0, vine: 1, thicket: 2 };
const puzzles = {};
for (const [mode, decoys] of Object.entries(modes)) {
  const rand = rng(20260927 + decoys * 7919);
  puzzles[mode] = [];
  for (const target of shuffle(targets, rand)) {
    const d = pickDecoys(target, decoys, rand);
    if (d === null) continue;
    const ring = shuffle([...target, ...d], rand).join('');
    // The answer is stored as positions on the ring, so it isn't sitting in plain text.
    const key = [...target].map(c => ring.indexOf(c).toString(36)).join('');
    puzzles[mode].push(`${ring}:${key}`);
  }
  console.log(mode, puzzles[mode].length, 'puzzles');
}

fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({
  five: five.join(' '),
  long: long.join(' '),
  puzzles,
}));
console.log('five', five.length, 'long', long.length);
