/*!
 * jyotish.js  One object for the whole instrument.
 *
 * Jyotish.create(bundle) wires the sky, the pañcāṅga, the calendar, the kuṇḍalī, the
 * matcher, the muhūrta finder, the countdowns and the music to one configuration.
 * The bundle is the parsed content of config/*.json, keyed by file name.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./jyotish-ephem.js"), require("./jyotish-panchang.js"), require("./jyotish-calendar.js"),
      require("./jyotish-kundali.js"), require("./jyotish-match.js"), require("./jyotish-muhurta.js"), require("./jyotish-events.js"), require("./jyotish-music.js"));
  } else root.Jyotish = factory(root.JyotishEphem, root.JyotishPanchang, root.JyotishCalendar, root.JyotishKundali,
    root.JyotishMatch, root.JyotishMuhurta, root.JyotishEvents, root.JyotishMusic);
})(typeof self !== "undefined" ? self : this, function (E, PM, CM, KM, MM, UM, EV, MS) {
  "use strict";
  var VERSION = "0.1.0";
  function create(b) {
    var cfg = { jyotish: b.jyotish, schools: b.schools, panchang: b.panchang, festivals: b.festivals, shraddha: b.shraddha,
                kundali: b.kundali, doshas: b.doshas, matching: b.matching, muhurta: b.muhurta, music: b.music };
    var P = PM.create(cfg), C = CM.create(P, cfg), K = KM.create(P, cfg);
    return { VERSION: VERSION, engine: E.VERSION, cfg: b, ephem: E, panchang: P, calendar: C, kundali: K,
             match: MM.create(P, K, cfg), muhurta: UM.create(P, C, cfg), events: EV.create(P, C, cfg), music: MS.create(cfg) };
  }
  return { create: create, VERSION: VERSION };
});
