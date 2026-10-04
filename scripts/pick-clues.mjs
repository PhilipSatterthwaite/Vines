// Picks a hard crossword clue for each answer in targets.txt (Wordle's list of
// everyday 5-letter answer words) and writes
// scripts/clues.tsv ("ANSWER<TAB>clue").
//
//   node scripts/pick-clues.mjs "path/to/Crossword Generator/docs/pastclues"
//
// The clues are NYT clues from Saul Pwanson's xd corpus, as collected by the
// Crossword Generator's Clues page: each answer's file entry is a list of
// [clue, times used, last year used]. Hard means, in order of preference:
// wordplay ("?"), an example rather than a definition ("e.g.", "for one"),
// rarely used, recent, and short. Clues that give the answer away, lean on
// other entries or on a fill-in blank, or are abbreviations are left out.
// Answers are kept only if every pair of neighbouring letters in them appears
// in some word Wordle accepts, so every letter can be reached by a vine
// (build.mjs then keeps only answers two guesses can finish).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2];
if (!dir) throw new Error('Pass the pastclues folder');

const five = fs.readFileSync(path.join(here, '.cache', 'wordle.txt'), 'utf8').split(/\r?\n/).filter(w => w.length === 5);
const reachable = new Set(five.flatMap(w => [0, 1, 2, 3].map(i => w[i] + w[i + 1])));
const targets = fs.readFileSync(path.join(here, 'targets.txt'), 'utf8').split(/\r?\n/).filter(Boolean);

const files = {};
const pastClues = word => {
  const file = word.slice(0, 2).toUpperCase();
  if (!(file in files)) {
    try { files[file] = JSON.parse(fs.readFileSync(path.join(dir, `${file}.json`), 'utf8')); } catch { files[file] = {}; }
  }
  return files[file][word.toUpperCase()] || [];
};

const unusable = /_{2,}|\b(across|down|theme|puzzle|starred|circled|shaded|clue|answer|abbr|var)\b|^see\b/i;
function hardness([text, uses, year]) {
  let score = 0;
  if (text.endsWith('?')) score += 6;
  if (/\b(e\.g\.|for one|for example|say)\b|, e\.g\.$/i.test(text)) score += 3;
  if (uses === 1) score += 2; else if (uses <= 3) score += 1;
  if (year >= 2010) score += 1;
  const words = text.split(/\s+/).length;
  if (words <= 4) score += 1;
  if (words === 1) score -= 1;   // a bare synonym is usually easy
  return score;
}

const out = [];
for (const word of targets) {
  const pairs = [...word].slice(1).map((c, i) => word[i] + c);
  if (!pairs.every(p => reachable.has(p))) continue;
  const stem = word.slice(0, Math.min(5, word.length - 1));
  const clues = pastClues(word).filter(([text, , year]) =>
    year >= 1994 && text.length <= 70 && !unusable.test(text) && !text.toLowerCase().includes(stem));
  if (!clues.length) continue;
  clues.sort((a, b) => hardness(b) - hardness(a) || a[1] - b[1] || b[2] - a[2]);
  out.push(`${word.toUpperCase()}\t${clues[0][0].replace(/\s+/g, ' ')}\t${hardness(clues[0])}`);
}
fs.writeFileSync(path.join(here, 'clues.tsv'), out.join('\n') + '\n');
console.log(`${out.length} of ${targets.length} answers have a clue`);
