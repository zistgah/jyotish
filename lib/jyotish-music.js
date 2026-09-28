/*!
 * jyotish-music.js  The music of the orbs, in just intonation.
 *
 * Each graha's sidereal longitude is placed on the octave and drawn to the nearest
 * svara of the rāga of the present prahar. Ratios, rāgas and the prahar mapping are
 * data (config/music.json); the page plays them with the Web Audio API.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JyotishMusic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function create(cfg) {
    var MU = cfg.music;
    function ratio(name) { var r = MU.svaras[name]; return r[0] / r[1]; }
    /* prahar: 0..3 by day, 4..7 by night, from a frame with sunrise, sunset, nextSunrise */
    function prahar(t, f) {
      if (t >= f.sunrise && t < f.sunset) return Math.min(3, Math.floor(4 * (t - f.sunrise) / (f.sunset - f.sunrise)));
      var s = t >= f.sunset ? f.sunset : f.sunset - 1, e = t >= f.sunset ? f.nextSunrise : f.sunrise;
      return 4 + Math.min(3, Math.max(0, Math.floor(4 * (t - s) / (e - s))));
    }
    function ragaFor(p) { var id = MU.prahar[String(p)]; return MU.ragas.filter(function (r) { return r.id === id; })[0]; }
    function voices(grahas, raga) {
      return MU.voices.map(function (v) {
        var g = grahas[v.graha]; if (!g) return null;
        var pos = g.lon / 360 * raga.scale.length, k = Math.round(pos) % raga.scale.length, sv = raga.scale[k];
        return { graha: v.graha, svara: sv, hz: MU.sa_hz * ratio(sv) * Math.pow(2, v.octave), gain: v.gain, retro: g.retro };
      }).filter(Boolean);
    }
    return { prahar: prahar, ragaFor: ragaFor, voices: voices, ratio: ratio };
  }
  return { create: create };
});
