# Vines

Grow vines between letters to find the hidden word.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

A ring of letters hides a word of 6 to 9 letters, with no repeated letters;
its length is shown. You get six guesses in total:

- **A 5-letter word** (any real word made from ring letters) grows a vine for
  every pair of neighbouring letters in it. A green vine means that pair sits
  side by side, in that order, in the hidden word; a withered one means it
  doesn't.
- **A word of the answer's length** is a guess at the answer. It only says right or wrong,
  and a wrong one still uses up a guess.

Three daily puzzles, one per mode:

| Mode    | Ring                    |
|---------|-------------------------|
| Sprout  | the answer's letters    |
| Vine    | plus one decoy letter   |
| Thicket | plus two decoy letters  |

## Data

`node scripts/build.mjs` writes `data/vines.json`: the guess dictionaries
(from ENABLE, downloaded once into `scripts/.cache`) and every mode's puzzles.
Answers come from `scripts/targets.txt`. Decoy letters are chosen so they
appear in plenty of 5-letter words and, where possible, leave other words of
the answer's length on the ring. Puzzle #1 is 2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
