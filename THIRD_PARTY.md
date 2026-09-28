# Third-party material

- **PyMeeus** (LGPL-3.0), https://pypi.org/project/PyMeeus/. `tools/gen_tables.py` extracts from it the VSOP87D coefficients (Bretagnon and Francou 1988), the Meeus Table 47 lunar terms (from ELP-2000/82, Chapront) and the IAU 1980 nutation table into `lib/data/jyotish-series.js`. The Delta-T polynomials of Espenak and Meeus follow its implementation.
- **Chakra** (GPL-3.0-or-later, same author), https://github.com/project-ilm/chakra at 13fa67d. `vendor/chakra-core.js` and `vendor/chakra-plus.js` are copied unchanged and pinned in `vendor/MANIFEST.json`.
- **pyswisseph** (AGPL-3.0), https://pypi.org/project/pyswisseph/. An external oracle only: `tools/oracle_sweph.py` writes its outputs, which are numbers, into `tests/vectors/oracle.json`. No code of it is in this tree and nothing here needs it to run or to test.
- **jsdom** (MIT). An optional test dependency for `tests/ui-smoke.js`, not vendored.
- **PyJHora** (AGPL-3.0) was consulted during development to cross-check the yoni and vashya tables. Nothing from it is in this tree.
