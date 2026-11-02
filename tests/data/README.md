# Ingredient evaluation set

`ingredient-cases.json` is the labelled set used by `tests/analyze.test.js`.

Each case: `id`, `category`, `text` (what the scanner receives), `expected` (`ok` / `warn` / `bad` / `unknown`),
`set` (`dev` or `holdout`), optional `note`, `debatable`, `knownGap`.

## How cases are labelled
Labels follow the stated principle, **not the current output of the engine**:

- `bad` (haram): pork and its derivatives, alcohol as an ingredient, blood.
- `warn` (mushbooh): a material ingredient whose source is not stated (gelatin, meat of unknown slaughter,
  animal fat, rennet/enzymes, E120, E441, E471 without a stated source, shellac, ...); also traces of pork.
- `ok`: ordinary plant ingredients, fish, a stated permissible source ("fish gelatin", "from palm oil",
  halal-certified), and explicit free-from statements ("pork-free", "alcohol-free").
- `unknown`: nothing that can be judged (empty, too short, gibberish, a nutrition table).

## Two sets, on purpose
- **`dev`**: cases used while the engine was being designed and fixed. They guard against regressions but say
  nothing about accuracy, because the engine was fitted to them. A holdout case that fails on first sight and is then
  fixed is moved here (its note says so).
- **`holdout`**: cases written *before* the engine was run on them, in realistic label wording. This is the honest
  accuracy signal. Add new ones in batches, write the label first, run second, and only then fix what fails.

`debatable: true` marks cases where scholars or certifiers differ. They are run and reported but never counted.

## Known gaps
`knownGap` marks a case the current engine gets wrong (the value says why). Those tests use `it.fails`, so they do
not break the build today, and the day an improvement fixes one the test fails with "expected to fail": delete its
`knownGap`.

## Limits
The labels were written by the developer and are not reviewed by a scholar. The sets are small and mostly English,
so the numbers are a regression signal, not a measure of real-world accuracy.
