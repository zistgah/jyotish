/*!
 * jyotish-muhurta.js  Windows for an occasion, with the reasons attached.
 *
 * The day is cut at every instant where anything the rules look at changes: tithi,
 * nakṣatra, yoga, karaṇa, lagna, the kālam windows, Abhijit, sunrise and sunset.
 * Each piece passes or fails the occasion's hard rules (config/muhurta.json); passing
 * pieces are joined, ranked by the soft preferences, and returned with the rule that
 * admitted them. Every failure is counted by its reason, so the empty answer explains
 * itself.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JyotishMuhurta = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function create(P, C, cfg) {
    var E = P.E, MU = cfg.muhurta, PC = cfg.panchang, KC = cfg.kundali;
    function occasion(id) { return MU.occasions.filter(function (o) { return o.id === id; })[0]; }
    function inAny(t, list) { return list.some(function (w) { return w && t >= w.start && t < w.end; }); }
    function dayLevel(d, day, o) {
      var fails = [], mid = (day.sunrise + day.sunset) / 2;
      if (o.avoid.indexOf("adhika") >= 0 && day.masa.adhika) fails.push("adhika");
      if (o.avoid.indexOf("pitru-paksha") >= 0 && day.masa.amanta === "Bhādrapada" && day.atSunrise.tithi.index >= 14) fails.push("pitru-paksha");
      if (o.avoid.indexOf("guru-asta") >= 0 || o.avoid.indexOf("shukra-asta") >= 0) {
        var g = E.grahas(mid, { ayanamsha: P.options.ayan }), sep = function (x) { return Math.abs(((g[x].lon - g.Sun.lon) % 360 + 540) % 360 - 180); };
        if (o.avoid.indexOf("guru-asta") >= 0 && sep("Jupiter") < KC.combustion_orb_deg.Jupiter) fails.push("guru-asta");
        if (o.avoid.indexOf("shukra-asta") >= 0 && sep("Venus") < (g.Venus.retro ? KC.combustion_orb_deg.Venus_retro : KC.combustion_orb_deg.Venus)) fails.push("shukra-asta");
      }
      return fails;
    }
    /* person: {moonSid} for tārābala and candrabala, optional */
    function find(id, from, days, place, person) {
      var o = occasion(id), out = [], rejected = {}, d, k;
      if (!o) throw new Error("unknown occasion " + id);
      var bump = function (r, len) { rejected[r] = (rejected[r] || 0) + len; };
      for (k = 0; k < days; k++) {
        d = C.addDays(from, k);
        var day = P.day(d[0], d[1], d[2], place);
        if (day.polar) continue;
        var dl = dayLevel(d, day, o), end = o.hours === "day" ? day.sunset : day.nextSunrise;
        if (dl.length) { dl.forEach(function (r) { bump(r, end - day.sunrise); }); continue; }
        var S = day.segments, cuts = [day.sunrise, day.sunset, end];
        ["tithi", "nakshatra", "yoga", "karana"].forEach(function (x) { day.limbs[x].forEach(function (s) { cuts.push(s.start, s.end); }); });
        day.lagna.forEach(function (l) { cuts.push(l.start, l.end); });
        ["rahu", "yamaganda", "gulika", "abhijit"].forEach(function (x) { cuts.push(S[x].start, S[x].end); });
        day.flags.panchaka.forEach(function (w) { cuts.push(w.start, w.end); });
        cuts = cuts.filter(function (t) { return t >= day.sunrise && t <= end; }).sort(function (a, b) { return a - b; });
        var i, windows = [], cur = null;
        for (i = 0; i + 1 < cuts.length; i++) {
          var a = cuts[i], b = cuts[i + 1]; if (b - a < 1 / 86400) continue;
          var t = (a + b) / 2, L = P.limbsAt(t), why = [], fail = null, score = 0;
          var tn = L.tithi.number, vara = day.vara.index, lg = day.lagna.filter(function (x) { return t >= x.start && t < x.end; })[0];
          if (o.good_tithis.indexOf(tn) < 0) fail = "tithi";
          else if (o.good_nakshatras.indexOf(L.nakshatra.index) < 0) fail = "nakshatra";
          else if (o.good_varas.indexOf(vara) < 0) fail = "vara";
          else if (o.lagna.indexOf("any") < 0 && (!lg || o.lagna.indexOf(lg.quality) < 0)) fail = "lagna";
          else if (o.avoid.indexOf("rahu") >= 0 && inAny(t, [S.rahu])) fail = "rahu";
          else if (o.avoid.indexOf("yamaganda") >= 0 && inAny(t, [S.yamaganda])) fail = "yamaganda";
          else if (o.avoid.indexOf("gulika") >= 0 && inAny(t, [S.gulika])) fail = "gulika";
          else if (o.avoid.indexOf("vishti") >= 0 && P.isVishti(L.karana.index)) fail = "vishti";
          else if (o.avoid.indexOf("panchaka") >= 0 && inAny(t, day.flags.panchaka)) fail = "panchaka";
          if (fail) { bump(fail, b - a); cur = null; continue; }
          why.push(L.tithi.pakshaName + " " + L.tithi.name, L.nakshatra.name, day.vara.name, lg ? "lagna " + lg.name + " (" + lg.quality + ")" : "");
          if (MU.bad_yogas.indexOf(L.yoga.index) < 0) score += MU.soft.good_yoga; else why.push("yoga " + L.yoga.name + " is one to avoid");
          if (inAny(t, [S.abhijit]) && !S.abhijit.excluded) { score += MU.soft.abhijit; why.push("inside Abhijit"); }
          if (person) {
            var n = ((L.nakshatra.index - Math.floor(person.moonSid / (360 / 27)) + 27) % 27) + 1, r = n % 9 || 9;
            if (MU.tarabala_bad.indexOf(r) < 0) { score += MU.soft.tarabala; why.push("tārābala good (" + r + ")"); } else why.push("tārābala weak (" + r + ")");
            var h = ((L.moonSign - Math.floor(person.moonSid / 30) + 12) % 12) + 1;
            if (MU.chandrabala_good.indexOf(h) >= 0) { score += MU.soft.chandrabala; why.push("candrabala good (" + h + ")"); } else why.push("candrabala weak (" + h + ")");
          }
          var sig = why.join("|") + score;
          if (cur && Math.abs(cur.end - a) < 1e-9 && cur.sig === sig) cur.end = b;
          else { cur = { start: a, end: b, score: score, why: why.filter(Boolean), sig: sig, date: C.key(d) }; windows.push(cur); }
        }
        windows.forEach(function (w) { if (w.end - w.start >= 12 / 1440) out.push(w); });
      }
      out.sort(function (p, q) { return q.score - p.score || (q.end - q.start) - (p.end - p.start); });
      return { occasion: o, windows: out, rejectedHours: Object.keys(rejected).map(function (r) { return { rule: r, hours: rejected[r] * 24 }; }).sort(function (a, b) { return b.hours - a.hours; }) };
    }
    return { find: find, occasion: occasion };
  }
  return { create: create };
});
