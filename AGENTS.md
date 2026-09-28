# For agents working on zistgah/jyotish

1. Read `CONTRACT.md`, `CONTEXT.md` and the master contract in zistgah/governance.
2. Run `bash ops/verify.sh` before and after any change. A change that leaves it red is not done.
3. A rule change is a change to `config/`, with its basis and sources, followed by `python3 tools/build_config.py`.
4. Never edit `vendor/`. Never hand-edit `lib/data/jyotish-series.js`; regenerate it with `python3 tools/gen_tables.py --floor 10`.
5. The oracle file is regenerated only with `python3 tools/oracle_sweph.py`, where pyswisseph is installed; it is never required to run or test.
6. Report partial work as partial and name what was not run.
