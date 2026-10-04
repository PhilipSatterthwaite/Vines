// Builds data/vines.json: the guess list and the daily puzzles.
//
//   node scripts/build.mjs
//
// Guesses are the words NYT Wordle accepts (Tab Atkins' copy of its list,
// downloaded once into scripts/.cache). Puzzles come from scripts/clues.tsv
// (made by pick-clues.mjs from targets.txt, Wordle's list of everyday answer
// words): a 5-letter answer and a hard crossword clue for it. Only clues that
// scored at least MIN_HARDNESS there are used.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cache = path.join(here, '.cache');
const listPath = path.join(cache, 'wordle.txt');

if (!fs.existsSync(listPath)) {
  fs.mkdirSync(cache, { recursive: true });
  const res = await fetch('https://raw.githubusercontent.com/tabatkins/wordle-list/main/words');
  fs.writeFileSync(listPath, await res.text());
}

const MIN_HARDNESS = 4;
const guesses = fs.readFileSync(listPath, 'utf8').split(/\r?\n/).filter(w => /^[a-z]{5}$/.test(w));
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
const puzzles = shuffle(clues, rng(20261004)).map(([answer, clue]) => [clue, hide(answer)]);

fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({ five: guesses.join(' '), puzzles }));
console.log('puzzles', puzzles.length, '| guesses', guesses.length);
