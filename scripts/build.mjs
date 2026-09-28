// Builds data/vines.json: the 5-letter guess list and the daily puzzles.
//
//   node scripts/build.mjs
//
// Guesses are the words NYT Wordle accepts (Tab Atkins' copy of its list,
// downloaded once into scripts/.cache). Puzzles come from scripts/clues.tsv
// (made by pick-clues.mjs): an answer of 6 to 9 letters and a hard crossword
// clue for it.
//
// Every puzzle can be finished (every blank grown green by a vine) in one or
// two guesses at best; answers that need three are dropped. That best is
// stored with each puzzle, along with a solution made of everyday words where
// one exists (Wordle's own answer list), to show once the game is over.
// Puzzles need a clue scoring at least MIN_HARDNESS, except the rare ones a
// single word can finish, which are all kept.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const cache = path.join(here, '.cache');

async function cached(name, url) {
  const file = path.join(cache, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(file, await (await fetch(url)).text());
  }
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(w => /^[a-z]{5}$/.test(w));
}
const guesses = await cached('wordle.txt', 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words');
const everyday = new Set(await cached('wordle-answers.txt',
  'https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/wordle-answers-alphabetical.txt'));

const MIN_HARDNESS = 4;
const clues = fs.readFileSync(path.join(here, 'clues.tsv'), 'utf8').split(/\r?\n/).filter(Boolean)
  .map(line => line.split('\t'));

// Bitmask of the answer's letters a guess's vines fill in.
function fills(guess, answer) {
  let mask = 0;
  for (let j = 0; j < 4; j++) {
    const pair = guess[j] + guess[j + 1];
    for (let i = answer.indexOf(pair); i >= 0; i = answer.indexOf(pair, i + 1)) mask |= 3 << i;
  }
  return mask;
}

// The fewest guesses that finish this answer (1, 2, or 3 meaning "more"),
// and one such set of guesses, everyday words first.
function best(answer) {
  const full = (1 << answer.length) - 1;
  const byMask = new Map();   // mask -> a word giving it, preferring everyday words
  for (const g of guesses) {
    const m = fills(g, answer);
    if (m && (!byMask.has(m) || (everyday.has(g) && !everyday.has(byMask.get(m))))) byMask.set(m, g);
  }
  if (byMask.has(full)) return { par: 1, words: [byMask.get(full)] };
  const masks = [...byMask.keys()];
  let pick = null, pickScore = -1;
  for (let x = 0; x < masks.length; x++) {
    for (let y = x + 1; y < masks.length; y++) {
      if ((masks[x] | masks[y]) !== full) continue;
      const words = [byMask.get(masks[x]), byMask.get(masks[y])];
      const score = words.filter(w => everyday.has(w)).length;
      if (score > pickScore) { pick = words; pickScore = score; }
      if (score === 2) return { par: 2, words: pick };
    }
  }
  return pick ? { par: 2, words: pick } : { par: 3, words: [] };
}

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

// Answers and solutions are stored reversed and base64'd, so they aren't sitting in plain text.
const hide = word => Buffer.from([...word.toLowerCase()].reverse().join('')).toString('base64');

const kept = [];
const dropped = { needsThree: 0, easyClue: 0 };
for (const [answer, clue, hardness] of clues) {
  const { par, words } = best(answer.toLowerCase());
  if (par > 2) { dropped.needsThree++; continue; }
  if (par === 2 && +hardness < MIN_HARDNESS) { dropped.easyClue++; continue; }
  kept.push({ answer, clue, par, words });
}

const puzzles = shuffle(kept, rng(20260930)).map(({ answer, clue, par, words }) => [clue, hide(answer), par, hide(words.join(' '))]);
fs.writeFileSync(path.join(root, 'data', 'vines.json'), JSON.stringify({ five: guesses.join(' '), puzzles }));

const lengths = {};
for (const { answer } of kept) lengths[answer.length] = (lengths[answer.length] || 0) + 1;
const ones = kept.filter(k => k.par === 1);
console.log('puzzles', kept.length, 'by length', lengths, '| dropped', dropped, '| guesses', guesses.length);
console.log(`one-word puzzles (${ones.length}):`, ones.map(k => `${k.answer}←${k.words[0].toUpperCase()}`).join(' '));
const plain = kept.filter(k => k.words.every(w => everyday.has(w))).length;
console.log(`solutions made only of everyday words: ${plain} of ${kept.length}`);
