# Vines

A crossword clue, a row of blanks, and six 5-letter words to grow the answer in.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

You're given a hard crossword clue and the answer's length (6 to 9 letters).
Guess any 5-letter word, using the whole alphabet. Wherever two neighbouring
letters in your guess also sit side by side in the answer, in that order, a
vine grows from those two tiles up to their place in the answer and fills them
in (every place, if the pair turns up more than once). A guessed letter that
is in the answer but isn't part of any vine turns yellow. Fill every blank
within six guesses to win.

## Data

- `scripts/targets.txt`: candidate answers, common 6- to 9-letter words.
- `node scripts/pick-clues.mjs <pastclues folder>` picks the hardest usable
  clue for each answer from the Crossword Generator's NYT clue collection
  (Saul Pwanson's xd corpus) and writes `scripts/clues.tsv` with a hardness
  score. Answers with a pair of letters no 5-letter word contains are dropped.
- `node scripts/build.mjs` writes `data/vines.json`: the 5-letter guess list
  (ENABLE, downloaded once into `scripts/.cache`) and the puzzles whose clue
  scored at least 4, shuffled. Puzzle #1 is 2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
