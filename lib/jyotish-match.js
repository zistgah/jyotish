/*!
 * jyotish-match.js  Aṣṭakūṭa, and what it becomes when a birth time is uncertain.
 *
 * The Moon's sign, nakṣatra and pada come from the Moon's longitude; Graha Maitrī
 * uses the lords of the two Moon signs; Bhakoot tests 2/12, 5/9 and 6/8. The Monte
 * Carlo samples each birth time (and optionally place) inside its stated uncertainty,
 * recomputes the Moon and lagna exactly for every sample, and reports the spread of
 * the total, the chance of each doṣa, and how much of the spread each birth causes.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JyotishMatch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NAK = 360 / 27;
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function create(P, K, cfg) {
    var E = P.E, M = cfg.matching, PC = cfg.panchang, KC = cfg.kundali, rev = E.rev;
    function moonFacts(moonSid) {
      var s = Math.floor(moonSid / 30), n = Math.floor(moonSid / NAK), deg = moonSid - s * 30;
      return { lon: moonSid, sign: s, deg: deg, nakshatra: n, pada: Math.floor((moonSid - n * NAK) / (NAK / 4)) + 1,
               lord: PC.rashi[s].lord, gana: PC.nakshatra[n].gana, nadi: PC.nakshatra[n].nadi, yoni: PC.nakshatra[n].yoni };
    }
    function vashyaGroup(f) { var g = M.vashya.by_sign[f.sign]; return Array.isArray(g) ? (f.deg < 15 ? g[0] : g[1]) : g; }
    function taraEach(from, to) { var n = ((to - from + 27) % 27) + 1, r = n % 9 || 9; return { count: n, rem: r, score: M.tara.bad.indexOf(r) >= 0 ? 0 : M.tara.each_direction }; }
    function rel(a, b) { if (a === b) return "friend"; var f = KC.natural_friendship[a]; return f.friends.indexOf(b) >= 0 ? "friend" : (f.enemies.indexOf(b) >= 0 ? "enemy" : "neutral"); }
    function maitri(a, b) {
      if (a === b) return { score: M.maitri.points["friend-friend"], key: "same lord" };
      var x = rel(a, b), y = rel(b, a), order = { friend: 0, neutral: 1, enemy: 2 }, k = [x, y].sort(function (p, q) { return order[p] - order[q]; }).join("-");
      return { score: M.maitri.points[k], key: k, ab: x, ba: y };
    }
    /* boy and girl are Moon sidereal longitudes */
    function kootas(boyMoon, girlMoon) {
      var b = moonFacts(boyMoon), g = moonFacts(girlMoon), rows = [], add = function (k, score, why) { rows.push({ koota: k, score: score, max: M.max[k], why: why }); };
      var vb = M.varna.by_sign[b.sign], vg = M.varna.by_sign[g.sign];
      add("varna", vb >= vg ? 1 : 0, M.varna.names[vb] + " and " + M.varna.names[vg]);
      var gb = vashyaGroup(b), gg = vashyaGroup(g);
      add("vashya", M.vashya.matrix_groom_rows[gb][gg], M.vashya.names[gb] + " and " + M.vashya.names[gg]);
      var t1 = taraEach(b.nakshatra, g.nakshatra), t2 = taraEach(g.nakshatra, b.nakshatra);
      add("tara", t1.score + t2.score, "counts " + t1.count + " and " + t2.count + " (remainders " + t1.rem + ", " + t2.rem + ")");
      var yp = M.yoni.enemy_pairs.some(function (p) { return (p[0] === b.yoni && p[1] === g.yoni) || (p[1] === b.yoni && p[0] === g.yoni); });
      var ys = b.yoni === g.yoni ? M.yoni.same : (yp ? M.yoni.enemy : M.yoni.other), Y = PC.nakshatra_attributes.yoni;
      add("yoni", ys, Y[b.yoni] + " and " + Y[g.yoni] + (yp ? ", enemies" : ""));
      var mt = maitri(b.lord, g.lord);
      add("maitri", mt.score, b.lord + " and " + g.lord + ", " + mt.key);
      var GN = PC.nakshatra_attributes.gana;
      add("gana", M.gana.table[b.gana][g.gana], GN[b.gana] + " and " + GN[g.gana]);
      var bc = ((g.sign - b.sign + 12) % 12) + 1, bdo = M.bhakoot.dosha_counts.indexOf(bc) >= 0;
      add("bhakoot", bdo ? 0 : M.bhakoot.points, "Moon signs " + bc + "/" + (((b.sign - g.sign + 12) % 12) + 1) + " apart");
      var nd = b.nadi === g.nadi, ND = PC.nakshatra_attributes.nadi;
      add("nadi", nd ? 0 : M.nadi.points, ND[b.nadi] + " and " + ND[g.nadi]);
      var total = rows.reduce(function (s, r) { return s + r.score; }, 0), canc = [];
      if (nd) {
        if (b.sign === g.sign && b.nakshatra !== g.nakshatra) canc.push({ koota: "nadi", id: "same-rashi-diff-nak" });
        if (b.nakshatra === g.nakshatra && b.sign !== g.sign) canc.push({ koota: "nadi", id: "same-nak-diff-rashi" });
        if (b.nakshatra === g.nakshatra && b.pada !== g.pada) canc.push({ koota: "nadi", id: "same-nak-diff-pada" });
      }
      if (bdo) {
        if (b.lord === g.lord) canc.push({ koota: "bhakoot", id: "same-lord" });
        else if (rel(b.lord, g.lord) === "friend" && rel(g.lord, b.lord) === "friend") canc.push({ koota: "bhakoot", id: "friendly-lords" });
      }
      if (M.gana.table[b.gana][g.gana] <= 1 && b.lord !== g.lord && rel(b.lord, g.lord) === "friend" && rel(g.lord, b.lord) === "friend") canc.push({ koota: "gana", id: "friendly-lords" });
      canc.forEach(function (c) { var list = M.cancellations[c.koota] || []; list.forEach(function (x) { if (x.id === c.id) c.text = x.text; }); });
      var verdict = M.verdict.filter(function (v) { return total >= v.min; })[0];
      return { boy: b, girl: g, rows: rows, total: total, max: 36, verdict: verdict ? verdict.text : "", cancellations: canc, applied: M.cancellations.apply,
               doshas: { nadi: nd, bhakoot: bdo, gana: M.gana.table[b.gana][g.gana] <= 1 } };
    }
    function mangalFrom(ascSign, moonSign, venusSign, marsSign, houses) {
      return [ascSign, moonSign, venusSign].some(function (s) { return houses.indexOf(((marsSign - s + 12) % 12) + 1) >= 0; });
    }
    /* birth: {Y,M,D,hours, place, uncertaintyMin, placeKm} */
    function prepare(bi) {
      var t = K.birthJd(bi), g = E.grahas(t, { ayanamsha: P.options.ayan, node: P.options.node });
      return { t: t, bi: bi, mars: g.Mars, venus: g.Venus };
    }
    function sampleOne(pr, rnd, vary) {
      var u = pr.bi.uncertaintyMin || 0, dt = vary ? (rnd() * 2 - 1) * u / 1440 : 0, t = pr.t + dt, place = pr.bi.place;
      if (vary && pr.bi.placeKm) {
        var r = pr.bi.placeKm * Math.sqrt(rnd()), th = 2 * Math.PI * rnd();
        place = { lat: place.lat + r * Math.cos(th) / 111.32, lon: place.lon + r * Math.sin(th) / (111.32 * Math.cos(place.lat * Math.PI / 180)), tz: place.tz };
      }
      var J = E.jde(t), moon = E.sidereal(E.moonApparent(J).lon, J, P.options.ayan), asc = P.ascSid(t, place);
      var mars = rev(pr.mars.lon + pr.mars.speed * dt), venus = rev(pr.venus.lon + pr.venus.speed * dt);
      return { moon: moon, asc: asc, mars: mars, venus: venus, dtMin: dt * 1440 };
    }
    function monteCarlo(boyBirth, girlBirth, opt) {
      opt = opt || {};
      var N = opt.samples || cfg.jyotish.monte_carlo.samples, seed = opt.seed === undefined ? cfg.jyotish.monte_carlo.seed : opt.seed;
      var houses = (function () { var r = cfg.doshas.rules.filter(function (x) { return x.id === "mangal"; })[0]; return r.schools[r.school] || r.houses; })();
      var pb = prepare(boyBirth), pg = prepare(girlBirth);
      function run(varyB, varyG, n, s) {
        var rnd = mulberry32(s), res = [], i;
        for (i = 0; i < n; i++) {
          var b = sampleOne(pb, rnd, varyB), g = sampleOne(pg, rnd, varyG), k = kootas(b.moon, g.moon);
          var mb = mangalFrom(Math.floor(b.asc / 30), Math.floor(b.moon / 30), Math.floor(b.venus / 30), Math.floor(b.mars / 30), houses);
          var mg = mangalFrom(Math.floor(g.asc / 30), Math.floor(g.moon / 30), Math.floor(g.venus / 30), Math.floor(g.mars / 30), houses);
          res.push({ total: k.total, nadi: k.doshas.nadi, bhakoot: k.doshas.bhakoot, gana: k.doshas.gana, mb: mb, mg: mg,
                     key: k.boy.nakshatra + "-" + k.boy.pada + "|" + k.girl.nakshatra + "-" + k.girl.pada });
        }
        return res;
      }
      var all = run(true, true, N, seed), onlyB = run(true, false, Math.max(200, N >> 2), seed + 1), onlyG = run(false, true, Math.max(200, N >> 2), seed + 2);
      function stats(list) {
        var n = list.length, m = 0, v = 0;
        list.forEach(function (r) { m += r.total; }); m /= n;
        list.forEach(function (r) { v += (r.total - m) * (r.total - m); }); v /= Math.max(1, n - 1);
        return { mean: m, sd: Math.sqrt(v), variance: v };
      }
      var S = stats(all), hist = {}, keys = {}, p = function (f) { return all.filter(f).length / all.length; };
      all.forEach(function (r) { hist[r.total] = (hist[r.total] || 0) + 1; keys[r.key] = (keys[r.key] || 0) + 1; });
      var vb = stats(onlyB).variance, vg = stats(onlyG).variance, vs = vb + vg;
      var totals = all.map(function (r) { return r.total; }).sort(function (a, b) { return a - b; });
      var q = function (x) { return totals[Math.min(totals.length - 1, Math.floor(x * totals.length))]; };
      var outcomes = Object.keys(keys).map(function (k) { return { key: k, p: keys[k] / N }; }).sort(function (a, b) { return b.p - a.p; });
      return {
        samples: N, seed: seed, nominal: kootas(sampleOne(pb, null, false).moon, sampleOne(pg, null, false).moon),
        mean: S.mean, sd: S.sd, min: totals[0], max: totals[totals.length - 1], p10: q(0.1), p50: q(0.5), p90: q(0.9),
        histogram: hist, pAtLeast18: p(function (r) { return r.total >= 18; }),
        pNadi: p(function (r) { return r.nadi; }), pBhakoot: p(function (r) { return r.bhakoot; }), pGana: p(function (r) { return r.gana; }),
        pManglikBoy: p(function (r) { return r.mb; }), pManglikGirl: p(function (r) { return r.mg; }), pManglikMismatch: p(function (r) { return r.mb !== r.mg; }),
        share: { boy: vs > 0 ? vb / vs : 0, girl: vs > 0 ? vg / vs : 0 }, outcomes: outcomes.slice(0, 8), distinctOutcomes: outcomes.length,
        method: "Uniform birth times within the stated window" + (boyBirth.placeKm || girlBirth.placeKm ? " and uniform places within the stated radius" : "") +
                "; the Moon and lagna are recomputed exactly for every sample, Mars and Venus move at their daily rate; seeded mulberry32 generator."
      };
    }
    return { kootas: kootas, moonFacts: moonFacts, monteCarlo: monteCarlo, maitri: maitri, mulberry32: mulberry32 };
  }
  return { create: create, mulberry32: mulberry32 };
});
