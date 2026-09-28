# Jyotish

A Sanatan panchang and jyotisha, computed and explained. It runs in the browser with no network and no server, and as a library in Node.

Dedicated to Shri Jyotish Chandra Chaudhuri.

## What it computes

- **The day.** Tithi, nakshatra with pada, yoga and karana, each with its start and end instants; kshaya and vriddhi tithis; vara from sunrise to sunrise; the amanta and purnimanta month with adhika and kshaya months by the sankranti rule; Vikrama, Shaka and Kali years and the samvatsara; ritu and ayana in both reckonings.
- **The windows of the day.** Sunrise, sunset, moonrise and moonset; Rahu Kala, Yamaganda, Gulika, Abhijit, Brahma muhurta, Pradosha, Nishitha, Kutapa, Rauhina and the five parts of daylight; choghadiya by day and night; the 24 horas; the rising lagna through the day; Panchaka, Ganda Moola and Bhadra with its vasa.
- **Observances.** 37 rules in `config/festivals.json`, each dated by the part of the day in which its tithi must hold, with its puja window and Bhadra removed where the rule says so. Anant Chaturdashi, Janmashtami at nishitha, Karwa Chauth at moonrise and Diwali in pradosha are among them.
- **Shraddh.** The tithi of death from a date, with or without the hour; the yearly date by the aparahna rule with Kutapa and Rauhina; the Pitru Paksha date; the fortnight's special days, Maha Bharani and Magha included; the computable families of the 96 occasions.
- **Kundali.** Sidereal positions of the nine grahas and the lagna; whole-sign houses and Sripati bhavas; dignity, combustion and retrogression; North, South and East charts; divisional charts D1 to D60; Vimshottari to five levels; doshas as the rules in `config/doshas.json` state them, with every cancellation that holds; Sade Sati and Dhaiya.
- **Matching.** Ashtakoota from each Moon's actual longitude, with the cancellation conditions shown. A Monte Carlo samples both births across their stated uncertainty and reports the spread of the total, the chance of each dosha and how much of the spread each birth causes.
- **Muhurta.** Ranked windows for 13 occasions over any span of days, with the reasons each window qualifies and the hours every rule ruled out.
- **Countdowns** to any solar, lunar, festival, muhurta or personal moment, on the dashboard and in the installed app, exportable as a calendar file.
- **Music of the orbs.** Each graha sounds the nearest svara of the prahar's raga, in just intonation.
- **Explanations.** Tap, right-click or select any result for its working: inputs, formula, intermediate values, the rule and its sources. From the working, any AI listed in `config/ai.json` can be asked, or a local model, with the place, date and reckoning already in the question.

## Accuracy

Measured against an independent ephemeris (pyswisseph in Moshier mode) at 201 yearly epochs from 1900 to 2100. The test suite re-measures on every run and fails if a published bound is exceeded.

| Quantity | Worst difference |
|---|---|
| Sun, apparent longitude | 0.49″ |
| Planets, apparent longitude | 4.6″ |
| Moon, apparent longitude | 7.8″ |
| Sidereal positions, Lahiri | 0.23″ for the Sun |
| Ascendant | 0.06″ |
| Sunrise and sunset | 4.2 s |
| Moonrise | 2.4 s |

The new moon of 26 September 2003 falls at 08:39:13 IST, inside the published minute.

## Use

Open `index.html`, or serve the folder and install it as an app. As a library:

```js
const fs = require("fs"), path = require("path");
const bundle = {};
for (const f of fs.readdirSync("config").filter(f => f.endsWith(".json")))
  bundle[f.replace(".config", "").replace(".json", "")] = JSON.parse(fs.readFileSync(path.join("config", f)));
const J = require("./lib/jyotish.js").create(bundle);
const day = J.panchang.day(2026, 9, 28, { lat: 17.385, lon: 78.4867, tz: 5.5 });
```

## Configuration

Every rule, name, window, table, source, provider and the dedication live in `config/`. Rules carry a basis with a status (`retrieved`, `convention`, `partial`, `sources-differ`, `not-verified`, `not-established`, `popular`) and source ids from `config/references.json`. After editing the JSON, `python3 tools/build_config.py` rebuilds `config/bundle.js`, which lets the page run from a file.

## Verification

`bash ops/verify.sh` runs the whole gate: the engine and configuration suite, the headless interface run when jsdom is available, the configuration bundle, the vendored hashes and the tree's hygiene. See `docs/METHOD.md` for how every number is computed.

## Provenance

Derived from Chakra (project-ilm/chakra at 13fa67d), concept DOI 10.5281/zenodo.21253628, whose core and plus files are vendored unchanged in `vendor/`. Third-party material is listed in `THIRD_PARTY.md`.

Software GPL-3.0-or-later (`LICENSE`); documents CC BY-SA 4.0 (`LICENSE-docs`).

© 1993–2026 Abhishek Choudhary. All rights reserved. AyeAI. ORCID 0009-0002-0684-8320.
