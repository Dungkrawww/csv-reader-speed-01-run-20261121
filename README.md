# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Dungkrawww/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Dungkrawww/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it answers exactly as csv-reader does on every case (same `{columns, rows, errors}`, including every broken-row error: `stray_cr`, `unterminated_quote`, `quote_junk`, `short_row`, `long_row`), but reads the text by jumping between delimiters instead of one character at a time — about 2.9× less CPU time than the house baseline on the practice set (6/6 cases identical).

- `solve.js` — the fast reader: `run(input)` returns csv-reader's answer for one case's `{text, header}`
- `main.ts` — the driver the harness runs (the house baseline's driver, kept as-is): reads every case from `/input/cases.json`, answers each with `run`, writes `/output/answers.json`

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=cmjmqzdv&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
