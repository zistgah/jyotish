# Contract: zistgah/jyotish

This overlay adds to the master contract in zistgah/governance and relaxes none of it.

**J1. The engine computes; the projection selects.** Jyotish shows the Hindu reckonings of Chakra's sky. Nothing is removed from the computation to make the projection.

**J2. Rules are configuration.** Every name, window, festival, Shraddh rule, dosha, koota table, occasion and provider lives in `config/`, with a basis status and source ids that exist in `config/references.json`. Code holds mechanisms, not rules.

**J3. Accuracy is measured, not asserted.** The bounds published in `config/jyotish.config.json` are re-measured by `tests/run.js` against an independent oracle whose outputs alone are stored. A bound that is exceeded fails the gate.

**J4. Chakra's files are vendored unchanged.** `vendor/MANIFEST.json` pins them by sha256 and a drift fails the gate.

**J5. No vendor in code.** Providers appear only in `config/ai.json`, alphabetically, with a keyless local option. The offline working is always shown first.

**J6. Unknown stays unknown.** An unrecorded hour yields every candidate tithi. A rule applied in part is marked partial, and what is not established is listed and not computed.

**J7. Views change what is shown, never what is computed.** The address carries the view, place, date and reckoning.

**J8. Offline.** The page makes no network request at run time except the one a person chooses when asking an AI.

Reconstruct faithfully. Critique with evidence, not tone. Maintain contract and context.
