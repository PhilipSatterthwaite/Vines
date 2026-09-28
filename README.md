# Vines

Grow vines between letters to find the hidden word.

Play: https://philipsatterthwaite.github.io/Vines/

## Rules

A ring of letters hides a word. The word uses every letter on the ring and
may use some more than once, so its length is unknown. Nothing else is given.
You get six guesses in total:

- **A 5-letter word** (any real word made from ring letters) grows a vine for
  every pair of neighbouring letters in it. A green vine means that pair sits
  side by side, in that order, somewhere in the hidden word; a withered one
  means it doesn't. A doubled letter (LL) grows a loop.
- **A longer word** that uses every ring letter is a guess at the answer. It
  only says right or wrong, and a wrong one still uses up a guess. The last
  guess has to be one of these.

## Data

`node scripts/build.mjs` writes `data/vines.json`: the guess dictionaries
(from ENABLE, downloaded once into `scripts/.cache`) and the daily puzzles.
Answers come from `scripts/targets.txt`, common 6- to 9-letter words. A
puzzle is kept only if its ring has at least one other common word (from
`scripts/common.txt`) that uses every letter, not counting the answer with an
ending added, and at least 12 playable 5-letter words. Puzzle #1 is
2026-09-27.

When `style.css`, `game.js` or the data change, bump the `?v=` numbers in
`index.html` (and the data fetch in `game.js`) so browsers pick them up.

## Run locally

```
python -m http.server 8000
```
