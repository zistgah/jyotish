/*!
 * jyotish-panchang.js  The pañcāṅga on the v2 sky.
 *
 * Every limb carries its start and end instants; the day runs sunrise to sunrise;
 * kṣaya and vṛddhi tithis are detected, not assumed away; the month follows the
 * saṅkrānti rule with adhika and kṣaya flagged. Names and tables come from
 * config/panchang.json and reckonings from config/schools.json.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./jyotish-ephem.js"));
  else root.JyotishPanchang = factory(root.JyotishEphem);
})(typeof self !== "undefined" ? self : this, function (E) {
  "use strict";
  var rev = E.rev, NAK = 360 / 27;
  function wrap(x) { return ((x % 360) + 540) % 360 - 180; }

  function create(cfg) {
    var P = cfg.panchang, SC = cfg.schools;
    var opt = {
      ayan: SC.ayanamsha.options[SC.ayanamsha.default],
      horizon: SC.horizon.options[SC.horizon.default].altitude_deg,
      node: SC.node.default, month: SC.month_system.default, ritu: SC.ritu.default, ayana: SC.ayana.default
    };
    function setSchool(key, value) {
      if (key === "ayanamsha") opt.ayan = SC.ayanamsha.options[value];
      else if (key === "horizon") opt.horizon = SC.horizon.options[value].altitude_deg;
      else opt[key] = value;
      memo = [];
    }

    /* ---- the sky at an instant, memoised ---- */
    var memo = [];
    function sky(t) {
      for (var i = 0; i < memo.length; i++) if (memo[i].t === t) return memo[i];
      var J = E.jde(t), sun = E.planetApparent("Sun", J).lon, moon = E.moonApparent(J).lon;
      var off = E.ayanamsha(J, opt.ayan) + E.nutation(J).dpsi;
      var s = { t: t, sun: sun, moon: moon, sunSid: rev(sun - off), moonSid: rev(moon - off), elong: rev(moon - sun), ayan: off };
      memo.unshift(s); if (memo.length > 8) memo.pop();
      return s;
    }
    var FN = {
      tithi: { f: function (t) { return sky(t).elong; }, size: 12, rate: 12.19 },
      karana: { f: function (t) { return sky(t).elong; }, size: 6, rate: 12.19 },
      nakshatra: { f: function (t) { return sky(t).moonSid; }, size: NAK, rate: 13.18 },
      yoga: { f: function (t) { var s = sky(t); return rev(s.sunSid + s.moonSid); }, size: NAK, rate: 14.17 },
      sunSign: { f: function (t) { return sky(t).sunSid; }, size: 30, rate: 0.9856 },
      moonSign: { f: function (t) { return sky(t).moonSid; }, size: 30, rate: 13.18 }
    };
    /* Newton on a monotonic angle; dir +1 forward, -1 backward from t0 */
    function solve(f, target, t0, rate, dir) {
      var d = dir > 0 ? rev(target - f(t0)) : -rev(f(t0) - target), t = t0 + d / rate, i, diff;
      for (i = 0; i < 20; i++) { diff = wrap(target - f(t)); t += diff / rate; if (Math.abs(diff) < 1e-8) break; }
      return t;
    }
    function span(kind, t) {
      var F = FN[kind], a = F.f(t), idx = Math.floor(a / F.size + 1e-12) % Math.round(360 / F.size);
      var start = solve(F.f, idx * F.size, t, F.rate, -1), end = solve(F.f, rev((idx + 1) * F.size), t + 1e-7, F.rate, 1);
      return { idx: idx, start: start, end: end };
    }
    function spans(kind, a, b) {
      var out = [], s = span(kind, a), guard = 0, cap = 8 + Math.ceil((b - a) * 2.5);
      while (s.start < b && guard++ < cap) { out.push(s); s = span(kind, s.end + 1e-6); }
      return out;
    }
    function newMoonBefore(t) { return solve(FN.tithi.f, 0, t, 12.19, -1); }
    function newMoonAfter(t) { return solve(FN.tithi.f, 0, t + 1e-6, 12.19, 1); }
    function fullMoonAfter(t) { return solve(FN.tithi.f, 180, t + 1e-6, 12.19, 1); }
    function sankrantiAfter(t) { var s = sky(t + 0.01).sunSid; return solve(FN.sunSign.f, (Math.floor(s / 30) + 1) * 30 % 360, t + 0.01, 0.9856, 1); }

    /* ---- names ---- */
    function tithiName(i) {
      var n = i % 15 + 1;
      return { index: i, number: n, paksha: i < 15 ? 0 : 1, pakshaName: P.paksha[i < 15 ? 0 : 1],
               name: n === 15 ? (i < 15 ? P.tithi[14] : P.amavasya) : P.tithi[n - 1] };
    }
    function karanaName(k) {
      if (P.karana.fixed[String(k)]) return P.karana.fixed[String(k)];
      return P.karana.movable[(k - 1) % 7];
    }
    function isVishti(k) { return k >= 1 && k <= 56 && (k - 1) % 7 === 6; }

    /* ---- the lunar month (saṅkrānti rule) ---- */
    function lunation(t) {
      var nm0 = newMoonBefore(t), nm1 = newMoonAfter(nm0 + 1);
      var s1 = Math.floor(sky(nm0).sunSid / 30), s2 = Math.floor(sky(nm1).sunSid / 30);
      var gap = (s2 - s1 + 12) % 12, idx = (s1 + 1) % 12;
      return { start: nm0, end: nm1, masaIndex: idx, masa: P.masa[idx], adhika: gap === 0, kshaya: gap === 2,
               sunSignAtStart: s1, sankrantis: gap };
    }
    function masaAt(t) {
      var L = lunation(t), krishna = sky(t).elong >= 180, pIdx = krishna ? (L.masaIndex + 1) % 12 : L.masaIndex;
      var pre = L.adhika ? "Adhika " : "";
      return { amanta: pre + L.masa, amantaIndex: L.masaIndex, purnimanta: pre + P.masa[pIdx], purnimantaIndex: pIdx,
               adhika: L.adhika, kshaya: L.kshaya, paksha: P.paksha[krishna ? 1 : 0], lunation: L,
               shown: opt.month === "purnimanta" ? pre + P.masa[pIdx] : pre + L.masa };
    }
    function lunations(a, b) {
      var out = [], L = lunation(a), guard = 0;
      while (L.start < b && guard++ < 20) { out.push(L); L = lunation(L.end + 1); }
      return out;
    }
    function samvat(t) {
      var L = lunation(t), guard = 0;
      while (L.masa !== P.masa[0] && guard++ < 14) L = lunation(L.start - 1);
      var c = E.civilFromJd(L.start + 0.5), vikram = c.Y + P.samvat.vikram_offset;
      var shaka = vikram + P.samvat.shaka_from_vikram;
      return { vikram: vikram, shaka: shaka, kali: shaka + P.samvat.kali_from_shaka,
               samvatsara: P.samvatsara[((shaka + 11) % 60 + 60) % 60], yearStart: L.start };
    }

    /* ---- the civil day at a place ---- */
    var frames = {};
    function localMidnight(Y, M, D, tz) { return E.jdFromCivil(Y, M, D, 0) - tz / 24; }
    function riseSetDay(m0, place) { return E.riseSet("Sun", m0, place.lat, place.lon, opt.horizon); }
    function frame(Y, M, D, place) {
      var key = [Y, M, D, place.lat, place.lon, place.tz, opt.horizon].join("|");
      if (frames[key]) return frames[key];
      var m0 = localMidnight(Y, M, D, place.tz), today = riseSetDay(m0, place), next = riseSetDay(m0 + 1, place), prev = riseSetDay(m0 - 1, place);
      var f = { Y: Y, M: M, D: D, m0: m0, sunrise: today.rise, sunset: today.set, nextSunrise: next.rise, prevSunset: prev.set,
                vara: ((Math.floor(E.jdFromCivil(Y, M, D, 12) + 1.5) % 7) + 7) % 7 };
      f.polar = f.sunrise === null || f.sunset === null || f.nextSunrise === null;
      frames[key] = f;
      return f;
    }
    function win(a, b, label) { return { start: a, end: b, label: label }; }
    function segments(f) {
      if (f.polar) return null;
      var sr = f.sunrise, ss = f.sunset, L = ss - sr, N = f.nextSunrise - ss, Np = sr - f.prevSunset, K = P.kalam, MU = P.muhurtas, i;
      var kal = function (list) { var k = list[f.vara] - 1; return win(sr + k * L / K.parts, sr + (k + 1) * L / K.parts); };
      var dm = function (k) { return win(sr + k * L / MU.day_count, sr + (k + 1) * L / MU.day_count); };
      var nm = function (k) { return win(ss + k * N / MU.night_count, ss + (k + 1) * N / MU.night_count); };
      var parts = []; for (i = 0; i < 5; i++) parts.push(win(sr + i * L / 5, sr + (i + 1) * L / 5, P.day_parts.five[i]));
      var ab = dm(MU.abhijit_day_index); ab.excluded = MU.abhijit_excluded_on_vara.indexOf(f.vara) >= 0;
      return {
        rahu: kal(K.rahu), yamaganda: kal(K.yamaganda), gulika: kal(K.gulika), abhijit: ab,
        brahma: win(f.prevSunset + MU.brahma_night_index * Np / MU.night_count, f.prevSunset + (MU.brahma_night_index + 1) * Np / MU.night_count),
        kutapa: dm(MU.kutapa_day_index), rauhina: dm(MU.rauhina_day_index), purvahna: win(sr, sr + L / 2),
        madhyahna: parts[2], aparahna: parts[3], dayParts: parts,
        pradosha: win(ss, ss + MU.pradosha_night_fraction * N), nishitha: nm(MU.nishitha_night_index),
        arunodaya: win(sr - 4 * 24 / 1440, sr), dayLength: L, nightLength: N
      };
    }
    function choghadiya(f) {
      if (f.polar) return null;
      var order = P.hora_order, C = P.choghadiya, out = { day: [], night: [] }, sr = f.sunrise, ss = f.sunset;
      var lord0 = P.vara_lord[f.vara], nlord0 = P.vara_lord[(f.vara + 4) % 7], i, lord;
      for (i = 0; i < 8; i++) {
        lord = order[(order.indexOf(lord0) + i) % 7];
        out.day.push({ lord: lord, name: C.by_lord[lord], quality: C.quality[C.by_lord[lord]], start: sr + i * (ss - sr) / 8, end: sr + (i + 1) * (ss - sr) / 8 });
        lord = order[(order.indexOf(nlord0) + i * 5) % 7];
        out.night.push({ lord: lord, name: C.by_lord[lord], quality: C.quality[C.by_lord[lord]], start: ss + i * (f.nextSunrise - ss) / 8, end: ss + (i + 1) * (f.nextSunrise - ss) / 8 });
      }
      return out;
    }
    function horas(f) {
      if (f.polar) return null;
      var order = P.hora_order, out = [], i, L = (f.sunset - f.sunrise) / 12, N = (f.nextSunrise - f.sunset) / 12, k0 = order.indexOf(P.vara_lord[f.vara]);
      for (i = 0; i < 24; i++) {
        var a = i < 12 ? f.sunrise + i * L : f.sunset + (i - 12) * N;
        out.push({ lord: order[(k0 + i) % 7], start: a, end: a + (i < 12 ? L : N), night: i >= 12 });
      }
      return out;
    }
    function ascSid(t, place) { var a = E.ascendant(t, place.lat, place.lon); return E.sidereal(a.asc, E.jde(t), opt.ayan); }
    function lagnaTable(a, b, place) {
      var out = [], step = 10 / 1440, t = a, s = Math.floor(ascSid(t, place) / 30), start = a, lo, hi, m, k;
      for (; t < b; t += step) {
        var t2 = Math.min(t + step, b), s2 = Math.floor(ascSid(t2, place) / 30);
        if (s2 !== s) {
          lo = t; hi = t2;
          for (k = 0; k < 30; k++) { m = (lo + hi) / 2; if (Math.floor(ascSid(m, place) / 30) === s) lo = m; else hi = m; }
          out.push({ sign: s, name: P.rashi[s].name, quality: P.rashi[s].quality, start: start, end: (lo + hi) / 2 });
          start = (lo + hi) / 2; s = s2;
        }
      }
      out.push({ sign: s, name: P.rashi[s].name, quality: P.rashi[s].quality, start: start, end: b });
      return out;
    }
    function flags(f, lim) {
      var a = f.sunrise, b = f.nextSunrise, out = { panchaka: [], gandaMoola: [], bhadra: [] }, pk = P.flags.panchaka;
      lim.nakshatra.forEach(function (n) {
        if (P.flags.ganda_moola.nakshatras.indexOf(n.idx) >= 0) out.gandaMoola.push(win(n.start, n.end, P.nakshatra[n.idx].name));
      });
      spans("moonSign", a, b).forEach(function (s) { if (s.idx === 10 || s.idx === 11) out.panchaka.push(win(s.start, s.end, P.rashi[s.idx].name)); });
      out.panchaka = mergeWins(out.panchaka);
      lim.karana.forEach(function (k) {
        if (isVishti(k.idx)) {
          var sign = Math.floor(sky(k.start).moonSid / 30), V = P.flags.bhadra_vasa, where = V.svarga.indexOf(sign) >= 0 ? "svarga" : (V.patala.indexOf(sign) >= 0 ? "patala" : "bhuloka");
          out.bhadra.push({ start: k.start, end: k.end, vasa: where, moonSign: P.rashi[sign].name });
        }
      });
      return out;
    }
    function mergeWins(list) {
      var out = []; list.forEach(function (w) { var l = out[out.length - 1]; if (l && Math.abs(l.end - w.start) < 1e-6) l.end = w.end; else out.push({ start: w.start, end: w.end, label: w.label }); });
      return out;
    }
    function limbsAt(t) {
      var s = sky(t), ti = Math.floor(s.elong / 12), ka = Math.floor(s.elong / 6), nk = Math.floor(s.moonSid / NAK), yo = Math.floor(rev(s.sunSid + s.moonSid) / NAK);
      return { tithi: tithiName(ti), karana: { index: ka, name: karanaName(ka) },
               nakshatra: { index: nk, name: P.nakshatra[nk].name, pada: Math.floor((s.moonSid - nk * NAK) / (NAK / 4)) + 1, lord: P.nakshatra[nk].lord },
               yoga: { index: yo, name: P.yoga[yo] }, sun: s.sun, moon: s.moon, sunSid: s.sunSid, moonSid: s.moonSid, elongation: s.elong,
               ayanamsha: s.ayan, moonSign: Math.floor(s.moonSid / 30), sunSign: Math.floor(s.sunSid / 30) };
    }
    function day(Y, M, D, place) {
      var f = frame(Y, M, D, place);
      if (f.polar) return { frame: f, polar: true, note: "The Sun does not both rise and set on this date here; the sunrise day is undefined." };
      var a = f.sunrise, b = f.nextSunrise;
      var lim = { tithi: spans("tithi", a, b), nakshatra: spans("nakshatra", a, b), yoga: spans("yoga", a, b), karana: spans("karana", a, b) };
      lim.tithi.forEach(function (s) {
        var n = tithiName(s.idx); s.name = n.name; s.number = n.number; s.paksha = n.pakshaName;
        s.kshaya = s.start > a && s.end < b; s.vriddhi = s.start <= a && s.end >= b;
      });
      lim.nakshatra.forEach(function (s) { s.name = P.nakshatra[s.idx].name; s.lord = P.nakshatra[s.idx].lord; });
      lim.yoga.forEach(function (s) { s.name = P.yoga[s.idx]; });
      lim.karana.forEach(function (s) { s.name = karanaName(s.idx); s.vishti = isVishti(s.idx); });
      var m0 = f.m0, moon = E.crossings("Moon", m0, m0 + 1, place.lat, place.lon), mr = null, ms = null;
      moon.forEach(function (c) { if (c.kind === "rise" && mr === null) mr = c.jd; if (c.kind === "set" && ms === null) ms = c.jd; });
      var at = limbsAt(a), mas = masaAt(a), sv = samvat(a);
      var rituIdx = opt.ritu === "vedic" ? P.ritu.vedic_by_masa[mas.amantaIndex] : (function () {
        var st = P.ritu.drik_by_tropical_sun_start_deg, x = at.sun, k; for (k = 0; k < 6; k++) { var lo = st[k], hi = st[(k + 1) % 6]; if (lo < hi ? (x >= lo && x < hi) : (x >= lo || x < hi)) return k; } return 0; })();
      var uttara = opt.ayana === "vedic" ? (at.sunSid >= 270 || at.sunSid < 90) : (at.sun >= 270 || at.sun < 90);
      return {
        frame: f, date: [Y, M, D], place: place, vara: { index: f.vara, name: P.vara[f.vara], lord: P.vara_lord[f.vara] },
        sunrise: a, sunset: f.sunset, nextSunrise: b, moonrise: mr, moonset: ms,
        atSunrise: at, limbs: lim, masa: mas, samvat: sv,
        ritu: { index: rituIdx, name: P.ritu.names[rituIdx], system: opt.ritu }, ayana: { uttarayana: uttara, system: opt.ayana },
        segments: segments(f), choghadiya: choghadiya(f), hora: horas(f), lagna: lagnaTable(a, b, place), flags: flags(f, lim),
        schools: { ayanamsha: opt.ayan.label, horizon: opt.horizon, month: opt.month, node: opt.node }
      };
    }

    return {
      sky: sky, solve: solve, span: span, spans: spans, limbsAt: limbsAt, tithiName: tithiName, karanaName: karanaName, isVishti: isVishti,
      newMoonBefore: newMoonBefore, newMoonAfter: newMoonAfter, fullMoonAfter: fullMoonAfter, sankrantiAfter: sankrantiAfter,
      lunation: lunation, lunations: lunations, masaAt: masaAt, samvat: samvat, frame: frame, segments: segments,
      choghadiya: choghadiya, horas: horas, lagnaTable: lagnaTable, ascSid: ascSid, day: day, localMidnight: localMidnight,
      setSchool: setSchool, options: opt, cfg: cfg, E: E
    };
  }
  return { create: create, VERSION: "2.0.0" };
});
