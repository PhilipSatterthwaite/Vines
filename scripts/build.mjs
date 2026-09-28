// Builds data/vines.json: the 5-letter guess dictionary and the daily puzzles.
//
//   node scripts/build.mjs
//
// Guesses are checked against ENABLE (downloaded once into scripts/.cache).
// Puzzles come from scripts/clues.tsv (made by pick-clues.mjs): each is an
// answer of 6 to 9 letters and a hard crossword clue for it. Only clues that
// scored at least MIN_HARDNESS there are used.

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

const MIN_HARDNESS = 4;
const five = fs.readFileSync(enablePath, 'utf8').split(/\r?\n/).filter(w => /^[a-z]{5}$/.test(w));
const clues = fs.readFileSync(path.join(here, 'clues.tsv'), 'utf8').split(/\r?\n/).filter(Boolean)
  .map(line => line.split('\t'))
  .filter(([, , hardness]) => +hardness >= MIN_HARDNESS);

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

// The answer is stored reversed and base64'd, so it isn't sitting in plain text.
const hide = word => Buffer.from([...word.toLowerCase()].reverse().join('')).toString('base64');
const puzzles = shuffle(clues, rng(20260929)).map(([answer, clue]) => [clue, hide(answer)]);

fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({ five: five.join(' '), puzzles }));
const lengths = {};
for (const [answer] of clues) lengths[answer.length] = (lengths[answer.length] || 0) + 1;
console.log('puzzles', puzzles.length, 'by length', lengths, '| five', five.length);
