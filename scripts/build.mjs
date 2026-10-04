// Builds data/vines.json: the guess list and the daily answers.
//
//   node scripts/build.mjs
//
// Guesses are the words NYT Wordle accepts (Tab Atkins' copy of its list,
// downloaded once into scripts/.cache). Answers are scripts/targets.txt,
// Wordle's list of everyday answer words, shuffled into a daily order.

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

const words = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(w => /^[a-z]{5}$/.test(w));
const guesses = words(listPath);
const answers = words(path.join(here, 'targets.txt'));

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

// Answers are stored reversed and base64'd, so they aren't sitting in plain text.
const hide = word => Buffer.from([...word].reverse().join('')).toString('base64');
const puzzles = shuffle(answers, rng(20261004)).map(hide);

fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({ five: guesses.join(' '), puzzles }));
console.log('puzzles', puzzles.length, '| guesses', guesses.length);
