# Vines

A crossword clue, five blanks, and six guesses to grow the answer in.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

You're given a hard crossword clue for a 5-letter word. Guess any word NYT
Wordle accepts. Wherever two neighbouring letters in your guess also sit side
by side in the answer, in that order, they turn green and a vine grows from
them up to their place in the answer, filling it in. Guessed letters that are
in the answer but grew no vine turn yellow, as hints only (each empty blank
accounts for one yellow, so repeats and letters already filled in aren't
yellow). Fill every blank within six guesses to win; guessing the answer
itself fills all of it at once. On the keyboard, guessed letters turn green if
they're in the answer and grey if not.

## Data

- `scripts/targets.txt`: candidate answers, Wordle's list of everyday answer
  words.
- `node scripts/pick-clues.mjs <pastclues folder>` picks the hardest usable
  clue for each answer from the Crossword Generator's NYT clue collection
  (Saul Pwanson's xd corpus) and writes `scripts/clues.tsv` with a hardness
  score.
- `node scripts/build.mjs` writes `data/vines.json`: the guess list (NYT
  Wordle's accepted words, via github.com/tabatkins/wordle-list, cached in
  `scripts/.cache`) and the puzzles whose clue scored at least 4, shuffled.
  Puzzle #1 is 2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
