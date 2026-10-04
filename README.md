# Vines

Five blanks and six guesses to grow the answer in, one pair of letters at a time.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

The answer is a hidden 5-letter word. Guess any word NYT Wordle accepts. Wherever two neighbouring letters in your guess also sit side
by side in the answer, in that order, they turn green and a vine grows from
them up to their place in the answer, filling it in. Guessed letters that are
in the answer but grew no vine turn yellow, as hints only (each empty blank
accounts for one yellow, so repeats and letters already filled in aren't
yellow). Fill every blank within six guesses to win; guessing the answer
itself fills all of it at once. On the keyboard, guessed letters turn green if
they're in the answer and grey if not.

## Data

- `scripts/targets.txt`: the answers, Wordle's list of everyday answer words.
- `node scripts/build.mjs` writes `data/vines.json`: the guess list (NYT
  Wordle's accepted words, via github.com/tabatkins/wordle-list, cached in
  `scripts/.cache`) and the answers in a shuffled daily order. Puzzle #1 is
  2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
