// Builds data/vines.json: the guess dictionaries and the daily puzzles.
//
//   node scripts/build.mjs
//
// Guesses are checked against ENABLE (downloaded once into scripts/.cache).
// Answers come from scripts/targets.txt: common 6- to 9-letter words, repeated
// letters allowed. The ring is just the answer's distinct letters, so it says
// nothing about the length. Rings with too few 5-letter words to guess are
// skipped.

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
// Answer guesses: longer words that could fit on a ring (at most 9 different letters).
const long = enable.filter(w => w.length >= 6 && w.length <= 12 && new Set(w).size <= 9);
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

const MIN_PROBES = 12;
const rand = rng(20260928);
const puzzles = [];
let skipped = 0;
for (const target of shuffle(targets, rand)) {
  const letters = [...new Set(target)];
  const set = new Set(letters);
  const probes = five.filter(w => [...w].every(c => set.has(c))).length;
  if (probes < MIN_PROBES) { skipped++; continue; }
  const ring = shuffle(letters, rand).join('');
  // The answer is stored as positions on the ring, so it isn't sitting in plain text.
  const key = [...target].map(c => ring.indexOf(c)).join('');
  puzzles.push(`${ring}:${key}`);
}

fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({
  five: five.join(' '),
  long: long.join(' '),
  puzzles,
}));
console.log('puzzles', puzzles.length, 'skipped', skipped, '| five', five.length, 'long', long.length);
