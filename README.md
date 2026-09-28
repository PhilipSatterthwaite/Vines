# Vines

A crossword clue, a row of blanks, and six 5-letter words to grow the answer in.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

You're given a hard crossword clue and the answer's length (6 to 9 letters).
Guess any 5-letter word NYT Wordle accepts. Wherever two neighbouring
letters in your guess also sit side by side in the answer, in that order, a
vine grows from those two tiles up to their place in the answer and fills them
in (every place, if the pair turns up more than once); those guess letters
turn green. Then any other guessed letter that belongs in a blank still empty
turns yellow and drops into the leftmost such blank; each blank takes one
letter, so repeats and letters already filled in aren't yellow. Yellow letters
are only hints: you win once every blank has been turned green by a vine.
Every puzzle can be finished in two guesses at best (16 in just one); the best
is shown after the game. On the keyboard,
guessed letters turn green if they're in the answer and grey if not. Fill every blank
within six guesses to win.

## Data

- `scripts/targets.txt`: candidate answers, common 6- to 9-letter words.
- `node scripts/pick-clues.mjs <pastclues folder>` picks the hardest usable
  clue for each answer from the Crossword Generator's NYT clue collection
  (Saul Pwanson's xd corpus) and writes `scripts/clues.tsv` with a hardness
  score. Answers with a pair of letters no 5-letter word contains are dropped.
- `node scripts/build.mjs` writes `data/vines.json`: the guess list (NYT
  Wordle's accepted words, via github.com/tabatkins/wordle-list, cached in
  `scripts/.cache`) and the puzzles, shuffled. It keeps answers that one or two
  guesses can finish, with a clue scoring at least 4 (one-guess answers are
  all kept), and stores a best solution for each, in everyday words (Wordle's
  answer list) where possible. Puzzle #1 is 2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
