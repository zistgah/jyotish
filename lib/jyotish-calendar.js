/*!
 * jyotish-calendar.js  Observances and Śrāddha, dated by rule.
 *
 * A rule (config/festivals.json, config/shraddha.json) names a month, a pakṣa, a tithi
 * or nakṣatra, and the part of the day in which it must hold. This module finds the
 * tithi's real span, measures it against that window on each candidate day, and
 * reports the day, the window, the fallback it needed and why. No date is stored.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JyotishCalendar = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function create(P, cfg) {           /* P: a JyotishPanchang instance */
    var E = P.E, PC = cfg.panchang, FEST = cfg.festivals, SHR = cfg.shraddha;
    var masaIndex = function (name) { return PC.masa.indexOf(name); };

    function ymd(jd, tz) { var c = E.civilFromJd(jd + tz / 24); return [c.Y, c.M, c.D]; }
    function key(d) { return d[0] + "-" + (d[1] < 10 ? "0" : "") + d[1] + "-" + (d[2] < 10 ? "0" : "") + d[2]; }
    function addDays(d, n) { var c = E.civilFromJd(E.jdFromCivil(d[0], d[1], d[2], 12) + n); return [c.Y, c.M, c.D]; }
    function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

    var moonriseCache = {};
    function moonrise(f, place) {
      var k = f.m0 + "|" + place.lat + "|" + place.lon;
      if (!(k in moonriseCache)) {
        var c = E.crossings("Moon", f.m0, f.m0 + 1, place.lat, place.lon), r = null;
        c.forEach(function (x) { if (x.kind === "rise" && r === null) r = x.jd; });
        moonriseCache[k] = r;
      }
      return moonriseCache[k];
    }
    /* the window of a day in which a tithi must hold */
    function windowOf(d, kind, place) {
      var f = P.frame(d[0], d[1], d[2], place);
      if (f.polar) return null;
      var sg = P.segments(f), L = f.sunset - f.sunrise;
      switch (kind) {
        case "udaya": return { at: f.sunrise, f: f };
        case "sunset": return { at: f.sunset, f: f };
        case "moonrise": var mr = moonrise(f, place); return mr === null ? null : { at: mr, f: f };
        case "day": return { start: f.sunrise, end: f.nextSunrise, f: f };
        case "first-third-of-day": return { start: f.sunrise, end: f.sunrise + L / 3, f: f };
        default: var w = sg[kind]; return w ? { start: w.start, end: w.end, f: f } : null;
      }
    }
    function measure(w, s) {
      if (!w) return 0;
      if (w.at !== undefined) return (w.at >= s.start && w.at < s.end) ? 1e-3 : 0;
      return overlap(w.start, w.end, s.start, s.end);
    }
    /* choose the civil day for a span under a vyāpti rule */
    function chooseDay(s, vyapti, prefer, place) {
      var d0 = addDays(ymd(s.start, place.tz), -1), n = Math.ceil(s.end - s.start) + 3, days = [], i, best = null;
      for (i = 0; i < n; i++) {
        var d = addDays(d0, i), w = windowOf(d, vyapti, place), u = windowOf(d, "udaya", place);
        days.push({ date: d, window: w, score: measure(w, s), atSunrise: u ? measure(u, s) > 0 : false, day: windowOf(d, "day", place) });
      }
      var how;
      if (prefer === "udaya") {
        for (i = 0; i < days.length; i++) if (days[i].atSunrise) { best = days[i]; how = "the tithi holds at sunrise"; break; }
        if (!best) how = "kṣaya tithi: no sunrise falls inside it, so the day holding most of it is taken";
      } else {
        for (i = 0; i < days.length; i++) if (days[i].score > 0 && (!best || days[i].score > best.score + 1e-9)) best = days[i];
        if (best) how = "the tithi holds the " + vyapti + " window longest on this day";
        else how = "the tithi touches no " + vyapti + " window, so the day holding most of it is taken";
      }
      if (!best) {
        for (i = 0; i < days.length; i++) { var sc = days[i].day ? overlap(days[i].day.start, days[i].day.end, s.start, s.end) : 0; if (sc > 0 && (!best || sc > best.dayScore)) { best = days[i]; best.dayScore = sc; } }
        if (best) best.fallback = true;
      }
      if (best) best.how = how;
      return best;
    }
    function subtract(w, holes) {
      var out = [w];
      holes.forEach(function (h) {
        var next = [];
        out.forEach(function (x) {
          if (h.end <= x.start || h.start >= x.end) { next.push(x); return; }
          if (h.start > x.start) next.push({ start: x.start, end: h.start });
          if (h.end < x.end) next.push({ start: h.end, end: x.end });
        });
        out = next;
      });
      return out.filter(function (x) { return x.end - x.start > 1 / 1440; });
    }
    function bhadraIn(a, b) {
      return P.spans("karana", a, b).filter(function (k) { return P.isVishti(k.idx); }).map(function (k) { return { start: k.start, end: k.end }; });
    }
    function pujaWindows(rule, pick, s, place) {
      var f = pick.window && pick.window.f ? pick.window.f : P.frame(pick.date[0], pick.date[1], pick.date[2], place), w;
      var spec = rule.puja || { window: "vyapti" };
      if (spec.window === "moonrise" || spec.window === "sunset") { w = windowOf(pick.date, spec.window, place); return w ? [{ at: w.at }] : []; }
      if (spec.window === "tithi-in-daylight") w = { start: Math.max(f.sunrise, s.start), end: Math.min(f.sunset, s.end) };
      else if (spec.window === "first-third-of-day") { var t3 = windowOf(pick.date, "first-third-of-day", place); w = { start: Math.max(t3.start, s.start), end: Math.min(t3.end, s.end) }; }
      else if (pick.window && pick.window.at !== undefined) w = { start: Math.max(f.sunrise, s.start), end: Math.min(f.sunset, s.end) };
      else if (pick.window) w = { start: Math.max(pick.window.start, s.start), end: Math.min(pick.window.end, s.end) };
      else return [];
      if (w.end <= w.start) return [];
      var list = [w], removed = [];
      if (spec.avoid && spec.avoid.indexOf("bhadra") >= 0) {
        removed = bhadraIn(w.start - 1, w.end + 1);
        list = subtract(w, removed);
        if (!list.length) {     /* Bhadrā covers the window: take the time after it ends, the same night */
          var endB = Math.max.apply(null, removed.map(function (x) { return x.end; }));
          var lim = Math.min(s.end, f.nextSunrise);
          if (endB < lim) list = [{ start: endB, end: lim, afterBhadra: true }];
        }
      }
      return list.map(function (x) { x.bhadraRemoved = removed.length > 0; return x; });
    }

    /* the span of tithi (0..29) inside a lunation */
    function tithiSpan(L, ti) {
      var f = function (t) { return P.sky(t).elong; };
      /* search forward from the lunation's own start, so the first crossing is the one found */
      var start = ti === 0 ? L.start : P.solve(f, ti * 12, L.start + 1e-6, 12.19, 1);
      var end = ti === 29 ? L.end : P.solve(f, (ti + 1) * 12, start + 1e-6, 12.19, 1);
      return { start: start, end: end, idx: ti };
    }
    function tIndex(paksha, tithi) { return paksha === "shukla" ? tithi - 1 : 15 + tithi - 1; }

    function datedRule(rule, L, ti, place) {
      var s = tithiSpan(L, ti), pick = chooseDay(s, rule.vyapti, rule.prefer, place);
      if (!pick) return null;
      return { id: rule.id, name: rule.name, en: rule.en, date: key(pick.date), ymd: pick.date, tithiStart: s.start, tithiEnd: s.end,
               masa: L.masa + (L.adhika ? " (adhika)" : ""), vyapti: rule.vyapti, prefer: rule.prefer, how: pick.how, fallback: !!pick.fallback,
               windows: pujaWindows(rule, pick, s, place), rule: rule };
    }
    function sankrantiDate(rule, Y, place) {
      var t0 = E.jdFromCivil(Y, 1, 1, 0) - 2, target = rule.sign * 30, out = [], f = function (t) { return P.sky(t).sunSid; };
      var guess = t0 + E.rev(target - f(t0)) / 0.9856, t = P.solve(f, target, guess - 3, 0.9856, 1);
      var d = ymd(t, place.tz), fr = P.frame(d[0], d[1], d[2], place);
      if (rule.rule === "before-sunset-same-day" && !fr.polar && t > fr.sunset) d = addDays(d, 1);
      if (d[0] === Y) out.push({ id: rule.id, name: rule.name, en: rule.en, date: key(d), ymd: d, instant: t, how: "the Sun enters " + PC.rashi[rule.sign].name + (t > fr.sunset ? " after sunset, so the next day" : " before sunset, so this day"), windows: [{ at: t }], rule: rule });
      return out;
    }
    var yearCache = {};
    function festivals(Y, place, ids) {
      var ck = Y + "|" + place.lat + "|" + place.lon + "|" + place.tz;
      if (!ids && yearCache[ck]) return yearCache[ck];
      var a = E.jdFromCivil(Y - 1, 12, 1, 0), b = E.jdFromCivil(Y + 1, 1, 31, 0), Ls = P.lunations(a, b), out = [];
      FEST.rules.forEach(function (r) {
        if (ids && ids.indexOf(r.id) < 0) return;
        if (r.type === "sankranti") { out = out.concat(sankrantiDate(r, Y, place)); return; }
        var pak = r.paksha === "both" ? ["shukla", "krishna"] : [r.paksha];
        Ls.forEach(function (L) {
          if (L.adhika) return;
          if (r.masa !== "*" && L.masa !== r.masa) return;
          pak.forEach(function (pk) {
            var x = datedRule(r, L, tIndex(pk, r.tithi), place);
            if (x && x.ymd[0] === Y) out.push(x);
          });
        });
      });
      out.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });
      if (!ids) yearCache[ck] = out;
      return out;
    }

    /* ---------- Śrāddha ---------- */
    function aparahnaPick(s, place) { return chooseDay(s, SHR.tithi_rule.window, SHR.tithi_rule.prefer, place); }
    function ritual(d, place) {
      var f = P.frame(d[0], d[1], d[2], place), sg = P.segments(f);
      return sg ? { kutapa: sg.kutapa, rauhina: sg.rauhina, aparahna: sg.aparahna } : null;
    }
    /* death: {Y,M,D, hours|null (local), place} */
    function deathTithi(death) {
      var pl = death.place, m0 = P.localMidnight(death.Y, death.M, death.D, pl.tz), cands = [];
      var describe = function (t, sp) {
        var li = P.limbsAt(t), ms = P.masaAt(t);
        return { tithiIndex: li.tithi.index, tithi: li.tithi.name, number: li.tithi.number, paksha: li.tithi.pakshaName,
                 amanta: ms.amanta, purnimanta: ms.purnimanta, amantaIndex: ms.amantaIndex, adhika: ms.adhika,
                 from: sp ? sp.start : null, to: sp ? sp.end : null, nakshatra: li.nakshatra.name };
      };
      if (death.hours !== null && death.hours !== undefined) {
        var t = m0 + death.hours / 24, sp = P.span("tithi", t), d = describe(t, sp); d.instant = t; cands.push(d);
        return { known: true, candidates: cands };
      }
      P.spans("tithi", m0, m0 + 1).forEach(function (sp) {
        var mid = (Math.max(sp.start, m0) + Math.min(sp.end, m0 + 1)) / 2, d = describe(mid, sp);
        d.holdsFrom = Math.max(sp.start, m0); d.holdsTo = Math.min(sp.end, m0 + 1); cands.push(d);
      });
      return { known: false, candidates: cands, note: "The hour is not recorded, so every tithi that held during the civil day is a candidate." };
    }
    function annualDates(cand, Y, place) {
      var a = E.jdFromCivil(Y - 1, 12, 1, 0), b = E.jdFromCivil(Y + 1, 1, 31, 0), out = [];
      P.lunations(a, b).forEach(function (L) {
        if (L.masaIndex !== cand.amantaIndex || L.adhika) return;
        var s = tithiSpan(L, cand.tithiIndex), pick = aparahnaPick(s, place);
        if (pick && pick.date[0] === Y) out.push({ date: key(pick.date), ymd: pick.date, tithiStart: s.start, tithiEnd: s.end, how: pick.how, windows: ritual(pick.date, place), masa: L.masa });
      });
      return { dates: out, adhikaNote: cand.adhika ? SHR.adhika_rule.basis.note : null };
    }
    function pitruPaksha(Y, place) {
      var a = E.jdFromCivil(Y, 7, 1, 0), b = E.jdFromCivil(Y, 12, 1, 0), L = null, next = null, Ls = P.lunations(a, b), i;
      for (i = 0; i < Ls.length; i++) if (Ls[i].masa === SHR.pitru_paksha.masa && !Ls[i].adhika) { L = Ls[i]; next = Ls[i + 1]; break; }
      if (!L) return null;
      var days = [], k;
      for (k = 14; k < 30; k++) {
        var s = tithiSpan(L, k), pick = aparahnaPick(s, place), tn = P.tithiName(k);
        days.push({ tithiIndex: k, number: tn.number, tithi: tn.name, paksha: tn.pakshaName, date: pick ? key(pick.date) : null, ymd: pick ? pick.date : null,
                    how: pick ? pick.how : null, tithiStart: s.start, tithiEnd: s.end, windows: pick ? ritual(pick.date, place) : null });
      }
      var special = SHR.special.map(function (sp) {
        var r = { id: sp.id, name: sp.name, for: sp.for, kind: sp.kind, basis: sp.basis };
        if (sp.kind === "tithi" && !sp.masa) {
          var ti = sp.paksha === "shukla" ? sp.tithi - 1 : 15 + sp.tithi - 1, row = days.filter(function (d) { return d.tithiIndex === ti; })[0];
          if (row) { r.date = row.date; r.windows = row.windows; }
        } else if (sp.kind === "tithi" && sp.masa && next) {
          var s2 = tithiSpan(next, sp.paksha === "shukla" ? sp.tithi - 1 : 15 + sp.tithi - 1), p2 = aparahnaPick(s2, place);
          if (p2) { r.date = key(p2.date); r.windows = ritual(p2.date, place); }
        } else if (sp.kind === "nakshatra") {
          var best = null;
          days.forEach(function (d) {
            if (!d.windows) return;
            var w = d.windows.aparahna, ns = P.spans("nakshatra", w.start, w.end), sc = 0;
            ns.forEach(function (n) { if (n.idx === sp.nakshatra) sc += overlap(n.start, n.end, w.start, w.end); });
            if (sc > 0 && (!best || sc > best.sc)) best = { sc: sc, d: d };
          });
          if (best) { r.date = best.d.date; r.windows = best.d.windows; r.how = PC.nakshatra[sp.nakshatra].name + " holds the aparāhṇa longest on this day of the fortnight"; }
        } else r.note = sp.basis.note;
        return r;
      });
      return { masa: L.masa, days: days, special: special };
    }
    function mahalayaFor(cand, Y, place) {
      var pp = pitruPaksha(Y, place); if (!pp) return null;
      var num = cand.number, row = pp.days.filter(function (d) { return d.number === num && (num !== 15 || d.tithiIndex === (cand.tithiIndex < 15 ? 14 : 29)); })[0];
      if (num !== 15) row = pp.days.filter(function (d) { return d.number === num && d.tithiIndex >= 15; })[0];
      return row || null;
    }
    function occasions96(Y, place) {
      var out = { amavasya: [], sankranti: [], mahalaya: [], vyatipata: [], vaidhriti: [] }, a = E.jdFromCivil(Y, 1, 1, 0) - place.tz / 24, b = E.jdFromCivil(Y + 1, 1, 1, 0) - place.tz / 24;
      P.lunations(a - 30, b).forEach(function (L) {
        var s = tithiSpan(L, 29), p = aparahnaPick(s, place);
        if (p && p.date[0] === Y) out.amavasya.push(key(p.date));
      });
      var t = a; for (var k = 0; k < 13; k++) { t = P.sankrantiAfter(t); if (t < b) out.sankranti.push({ instant: t, date: key(ymd(t, place.tz)), sign: PC.rashi[Math.round(P.sky(t + 0.01).sunSid / 30) % 12].name }); }
      var pp = pitruPaksha(Y, place); if (pp) out.mahalaya = pp.days.map(function (d) { return d.date; });
      P.spans("yoga", a, b).forEach(function (y) {
        if (y.idx === 16) out.vyatipata.push(key(ymd(y.start, place.tz)));
        if (y.idx === 26) out.vaidhriti.push(key(ymd(y.start, place.tz)));
      });
      out.notEstablished = SHR.occasions_96.not_established;
      return out;
    }
    return { festivals: festivals, chooseDay: chooseDay, windowOf: windowOf, tithiSpan: tithiSpan, deathTithi: deathTithi,
             annualDates: annualDates, pitruPaksha: pitruPaksha, mahalayaFor: mahalayaFor, occasions96: occasions96, key: key, ymd: ymd, addDays: addDays };
  }
  return { create: create };
});
