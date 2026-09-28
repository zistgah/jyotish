/*!
 * jyotish-kundali.js  The lagna kuṇḍalī on the v2 sky.
 *
 * Positions from jyotish-ephem.js; houses whole-sign and Śrīpati; dignity, combustion
 * and friendship from config/kundali.json; divisional signs from Chakra's own
 * chakra-plus.js (vendored unchanged); Vimśottarī to five levels; doṣas exactly as
 * config/doshas.json states them, with every cancellation that holds listed.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../vendor/chakra-plus.js"));
  else root.JyotishKundali = factory(root.ChakraPlus);
})(typeof self !== "undefined" ? self : this, function (Plus) {
  "use strict";
  var NAK = 360 / 27;

  function create(P, cfg) {
    var E = P.E, K = cfg.kundali, PC = cfg.panchang, DO = cfg.doshas, rev = E.rev;
    var SEVEN = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
    function signOf(l) { return Math.floor(rev(l) / 30); }
    function houseFrom(fromSign, sign) { return (sign - fromSign + 12) % 12 + 1; }
    function relation(a, b) {                       /* how a regards b, natural */
      var f = K.natural_friendship[a]; if (!f) return "neutral";
      return f.friends.indexOf(b) >= 0 ? "friend" : (f.enemies.indexOf(b) >= 0 ? "enemy" : "neutral");
    }
    function dignity(g, lon) {
      var s = signOf(lon), d = rev(lon) - s * 30, D = K.dignity, ex = D.exaltation[g], mt = D.moolatrikona[g];
      if (!ex) return { state: "—" };
      if (s === ex[0]) return { state: "exalted", deep: Math.abs(d - ex[1]) < 1 };
      if (s === (ex[0] + 6) % 12) return { state: "debilitated", deep: Math.abs(d - ex[1]) < 1 };
      if (mt && s === mt[0] && d >= mt[1] && d < mt[2]) return { state: "mūlatrikoṇa" };
      var lord = PC.rashi[s].lord;
      if (lord === g) return { state: "own sign" };
      return { state: relation(g, lord) + "'s sign", lord: lord };
    }
    function combust(g, pos, sun) {
      if (g === "Sun" || g === "Rahu" || g === "Ketu") return false;
      var O = K.combustion_orb_deg, orb = (pos.retro && O[g + "_retro"]) ? O[g + "_retro"] : O[g];
      var sep = Math.abs(((pos.lon - sun.lon) % 360 + 540) % 360 - 180);
      return orb !== undefined && sep < orb;
    }
    function sripati(asc, mc) {
      var ic = rev(mc + 180), ds = rev(asc + 180), m = new Array(12), q = [[asc, ic], [ic, ds], [ds, mc], [mc, asc]], i, k;
      for (i = 0; i < 4; i++) { var a = q[i][0], arc = rev(q[i][1] - a); for (k = 0; k < 3; k++) m[i * 3 + k] = rev(a + k * arc / 3); }
      var sandhi = m.map(function (x, j) { var p = m[(j + 11) % 12]; return rev(p + rev(x - p) / 2); });
      return { madhya: m, sandhi: sandhi };
    }
    function bhavaOf(lon, sandhi) {
      for (var i = 0; i < 12; i++) { var a = sandhi[i], b = sandhi[(i + 1) % 12]; if (rev(lon - a) < rev(b - a)) return i + 1; }
      return 1;
    }
    function birthJd(b) { return P.localMidnight(b.Y, b.M, b.D, b.place.tz) + b.hours / 24; }

    function chart(b) {
      var t = birthJd(b), g = E.grahas(t, { ayanamsha: P.options.ayan, node: P.options.node }), J = E.jde(t);
      var A = E.ascendant(t, b.place.lat, b.place.lon), asc = E.sidereal(A.asc, J, P.options.ayan), mc = E.sidereal(A.mc, J, P.options.ayan);
      var ascSign = signOf(asc), sp = sripati(asc, mc), pos = {}, names = K.grahas;
      names.forEach(function (n) {
        var p = g[n], s = signOf(p.lon), nk = Math.floor(p.lon / NAK);
        pos[n] = { lon: p.lon, sign: s, signName: PC.rashi[s].name, deg: p.lon - s * 30, nakshatra: nk, nakshatraName: PC.nakshatra[nk].name,
                   pada: Math.floor((p.lon - nk * NAK) / (NAK / 4)) + 1, speed: p.speed, retro: p.retro,
                   house: houseFrom(ascSign, s), bhava: bhavaOf(p.lon, sp.sandhi), dignity: dignity(n, p.lon) };
      });
      names.forEach(function (n) { pos[n].combust = combust(n, pos[n], pos.Sun); });
      var an = Math.floor(asc / NAK);
      pos.Asc = { lon: asc, sign: ascSign, signName: PC.rashi[ascSign].name, deg: asc - ascSign * 30, nakshatra: an, nakshatraName: PC.nakshatra[an].name,
                  pada: Math.floor((asc - an * NAK) / (NAK / 4)) + 1, house: 1, bhava: 1 };
      return { t: t, birth: b, pos: pos, asc: asc, mc: mc, ascSign: ascSign, sripati: sp, ayanamsha: E.ayanamsha(J, P.options.ayan),
               schools: { ayanamsha: P.options.ayan.label, node: P.options.node } };
    }
    function varga(ch, n) {
      var out = {}, k;
      for (k in ch.pos) if (Object.prototype.hasOwnProperty.call(ch.pos, k)) out[k] = Math.floor(rev(Plus.vargaPlus(ch.pos[k].lon, n)) / 30);
      return { n: n, signs: out, ascSign: out.Asc };
    }

    /* ---- Vimśottarī ---- */
    function vimshottari(ch, yearDays) {
      var V = K.vimshottari, moon = ch.pos.Moon.lon, k = Math.floor(moon / NAK), frac = (moon - k * NAK) / NAK;
      var lord = V.lords[k % 9], Y = yearDays || 365.2425, start = ch.t - frac * V.years[lord] * Y;
      function kids(node) {
        if (node.level >= V.levels.length - 1) return [];
        var i0 = V.lords.indexOf(node.lord), t = node.start, out = [], j;
        for (j = 0; j < 9; j++) {
          var L = V.lords[(i0 + j) % 9], len = (node.end - node.start) * V.years[L] / 120;
          out.push({ lord: L, start: t, end: t + len, level: node.level + 1 }); t += len;
        }
        return out;
      }
      var md = [], t = start, i0 = V.lords.indexOf(lord), j;
      for (j = 0; j < 9; j++) { var L = V.lords[(i0 + j) % 9], len = V.years[L] * Y; md.push({ lord: L, start: t, end: t + len, level: 0 }); t += len; }
      function at(when) {
        var path = [], list = md, lvl;
        for (lvl = 0; lvl < V.levels.length; lvl++) {
          var hit = null; list.forEach(function (n) { if (when >= n.start && when < n.end) hit = n; });
          if (!hit) break; path.push(hit); list = kids(hit);
        }
        return path;
      }
      return { mahadasha: md, children: kids, at: at, balance: { lord: lord, years: (1 - frac) * V.years[lord] }, levels: V.levels, yearDays: Y };
    }

    /* ---- doṣas, as the rules state them ---- */
    function conj(ch, a, b) { return ch.pos[a].sign === ch.pos[b].sign; }
    function doshas(ch) {
      var out = [];
      DO.rules.forEach(function (r) {
        var res = { id: r.id, name: r.name, basis: r.basis, present: false, detail: [], cancellations: [] };
        if (r.type === "mars-houses") {
          var houses = r.schools[r.school] || r.houses, marsSign = ch.pos.Mars.sign;
          r.from.forEach(function (ref) {
            var h = houseFrom(ch.pos[ref].sign, marsSign), hit = houses.indexOf(h) >= 0;
            res.detail.push({ from: ref, house: h, present: hit }); if (hit) res.present = true;
          });
          if (res.present) r.cancellations.forEach(function (c) {
            var holds = false, hA = houseFrom(ch.ascSign, marsSign);
            if (c.test === "mars-sign-in") holds = c.signs.indexOf(marsSign) >= 0;
            else if (c.test === "mars-house-sign") holds = !!(c.pairs[String(hA)] && c.pairs[String(hA)].indexOf(marsSign) >= 0);
            else if (c.test === "conjunct") holds = conj(ch, c.a, c.b);
            if (holds) res.cancellations.push({ id: c.id, text: c.text });
          });
          res.school = r.school; res.houses = houses;
        } else if (r.type === "kalasarpa") {
          var R = ch.pos.Rahu.lon, inside = 0, outside = 0;
          SEVEN.forEach(function (g) { if (rev(ch.pos[g].lon - R) < 180) inside++; else outside++; });
          if (inside === 7 || outside === 7) {
            res.present = true; var h = ch.pos.Rahu.house;
            res.detail.push({ type: r.types[h - 1], rahuHouse: h, side: inside === 7 ? "Rāhu to Ketu" : "Ketu to Rāhu" });
          }
        } else if (r.type === "conjunct") {
          var As = [].concat(r.a), Bs = [].concat(r.b);
          As.forEach(function (a) { Bs.forEach(function (b) { if (conj(ch, a, b)) { res.present = true; res.detail.push({ with: [a, b] }); } }); });
          if (r.also && ch.pos[r.also.graha].house === r.also.house) { res.present = true; res.detail.push({ graha: r.also.graha, house: r.also.house }); }
        } else if (r.type === "kemadruma") {
          var ms = ch.pos.Moon.sign, others = SEVEN.filter(function (g) { return g !== "Moon" && r.exclude.indexOf(g) < 0; });
          var flank = others.filter(function (g) { var h = houseFrom(ms, ch.pos[g].sign); return h === 2 || h === 12; });
          if (!flank.length) {
            res.present = true;
            var kendra = others.filter(function (g) { return [1, 4, 7, 10].indexOf(houseFrom(ms, ch.pos[g].sign)) >= 0; });
            if (kendra.length) res.cancellations.push({ id: "kendra-from-moon", text: r.cancellations[0].text + ": " + kendra.join(", ") });
          }
        } else return;
        res.status = !res.present ? "absent" : (res.cancellations.length ? "present, with cancellations that hold" : "present");
        out.push(res);
      });
      return out;
    }
    /* Saturn over the natal Moon: current phase and the windows around a date */
    function saturnTransit(ch, when, yearsAround) {
      var ms = ch.pos.Moon.sign, a = when - (yearsAround || 8) * 365.25, b = when + (yearsAround || 8) * 365.25, step = 10, list = [], t, prev = null, cur;
      var satSign = function (x) { return Math.floor(E.grahas(x, { ayanamsha: P.options.ayan }).Saturn.lon / 30); };
      var cls = function (s) { var h = houseFrom(ms, s); return h === 12 || h === 1 || h === 2 ? "sade-sati" : (h === 4 || h === 8 ? "dhaiya" : null); };
      for (t = a; t <= b; t += step) {
        cur = cls(satSign(t));
        if (cur !== prev) { if (list.length) list[list.length - 1].end = t; if (cur) list.push({ kind: cur, start: t, end: null }); prev = cur; }
      }
      var s0 = satSign(when), h0 = houseFrom(ms, s0);
      return { now: { kind: cls(s0), houseFromMoon: h0, phase: h0 === 12 ? "rising" : h0 === 1 ? "peak" : h0 === 2 ? "setting" : null }, windows: list, resolutionDays: step };
    }
    return { chart: chart, varga: varga, vimshottari: vimshottari, doshas: doshas, saturnTransit: saturnTransit, relation: relation,
             signOf: signOf, houseFrom: houseFrom, birthJd: birthJd, dignity: dignity };
  }
  return { create: create };
});
