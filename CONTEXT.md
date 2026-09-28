# Context: zistgah/jyotish

Jyotish is the Kaivalyik projection of Chakra: a Sanatan panchang and jyotisha built on a precise second-generation engine, with every rule held in configuration. It is seeded under zistgah and may move organisations later.

- **Upstream.** project-ilm/chakra at 13fa67d (concept DOI 10.5281/zenodo.21253628). Chakra stays as it is; its core and plus files are vendored unchanged here, and its divisional-chart code is used as it stands.
- **Engine.** `lib/jyotish-ephem.js` (VSOP87D planets, ELP-2000 Moon via Meeus, IAU 1980 nutation, Espenak and Meeus Delta-T), with the panchang, calendar, kundali, matching, muhurta, events and music modules over it and `lib/jyotish.js` as the one entry point.
- **Spine.** `dhancha/jyotish.json` describes Jyotish as a domain on zistgah/dhancha.
- **What is owed** is listed with acceptance criteria in `roadmap.json`.
- **Dedication.** `config/dedication.json`. A biography renders from `content/biography.md` once that file exists.
