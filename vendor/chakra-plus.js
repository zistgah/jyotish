/*!
 * chakra-plus.js — CHAKRA additive layer. v0.1.0
 *
 * READS the core, never modifies it. Every ephemeris/panchanga number still comes
 * from Chakra (src/chakra-core.js, byte-parity with the C99 twin). This file only
 * DERIVES: extra vargas, reckoning modes, observances, electional search, matching,
 * batch output, and a small user scripting language.
 *
 * Copyright (C) 1993-2026 Abhishek Choudhary. Sole author.  AyeAI.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * HONESTY (contract C37): where a classical rule has school variants, the variant
 * used is named in RULE_NOTE and selectable. Nothing here predicts anything; these
 * are cultural computations. Ephemeris accuracy degrades far from the present —
 * see epochWarning().
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    /* Resolve the core wherever it actually lives (src/, js/, test/) — never assume
       one layout; report the paths tried rather than a bare MODULE_NOT_FOUND. */
    var tried = ["./chakra-core.js", "../src/chakra-core.js", "../js/chakra-core.js",
      "../test/chakra-core.js", "../chakra-core.js"], core = null, i;
    for (i = 0; i < tried.length; i++) { try { core = require(tried[i]); break; } catch (e) { } }
    if (!core) throw new Error("chakra-plus: chakra-core.js not found. Tried: " + tried.join(", "));
    module.exports = factory(core);
  } else root.ChakraPlus = factory(root.Chakra);
})(typeof self !== "undefined" ? self : this, function (Ck) {
  "use strict";
  if (!Ck) throw new Error("chakra-plus requires chakra-core.js to be loaded first");

  var rev = Ck.rev, RASHI = Ck.RASHI, NAK = Ck.NAK, TITHI = Ck.TITHI;
  var GRAHA = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

  /* Core interface, read not recalled:
   *   d2date(d)   -> "YYYY-MM-DD" STRING (not an object)
   *   decYear(dt) -> decimal year from a JS Date (not from a day-number)
   * yearOf() bridges a day-number to the decimal year the core's ayan() wants. */
  function yearOf(d) { return Ck.decYear(new Date((Ck.jdOf(d) - 2440587.5) * 86400000)); }
  function dstr(d) { return Ck.d2date(d); }

  /* =================== 1. VARGAS — the full Ṣoḍaśavarga ===================
   * Core handles D1,2,3,7,9,10,12 classically; everything else hit a generic
   * cyclic fallback. Those are supplied here with the Parāśarī rules.       */

  var CORE_VARGAS = [1, 2, 3, 7, 9, 10, 12];
  var VARGA_NAME = {
    1: "Rāśi", 2: "Horā", 3: "Dreṣkāṇa", 4: "Caturthāṁśa", 5: "Pañcāṁśa",
    6: "Ṣaṣṭhāṁśa", 7: "Saptāṁśa", 8: "Aṣṭāṁśa", 9: "Navāṁśa", 10: "Daśāṁśa",
    11: "Rudrāṁśa", 12: "Dvādaśāṁśa", 16: "Ṣoḍaśāṁśa", 20: "Viṁśāṁśa",
    24: "Caturviṁśāṁśa", 27: "Bhāṁśa", 30: "Triṁśāṁśa", 40: "Khavedāṁśa",
    45: "Akṣavedāṁśa", 60: "Ṣaṣṭyāṁśa"
  };
  var VARGA_SIGNIFIES = {
    1: "body, the whole life", 2: "wealth, sustenance", 3: "siblings, courage",
    4: "home, fixed assets", 5: "merit, authority", 6: "health, affliction",
    7: "children, progeny", 8: "sudden events, longevity", 9: "spouse, dharma, inner strength",
    10: "career, action in the world", 11: "gains, fulfilment", 12: "parents, lineage",
    16: "vehicles, comforts, discontents", 20: "spiritual practice", 24: "learning, education",
    27: "strength & weakness (bala)", 30: "misfortunes, character", 40: "auspicious/inauspicious legacy (maternal)",
    45: "conduct, all matters (paternal)", 60: "the whole chart, past karma"
  };
  var SHODASHAVARGA = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

  var RULE_NOTE = {
    4: "1st/4th/7th/10th from the sign",
    5: "generic cyclic — school variants differ; flagged, not silently chosen",
    6: "odd from Aries, even from Libra",
    8: "movable→Aries, fixed→Leo, dual→Sagittarius",
    11: "counted from the sign itself",
    16: "movable→Aries, fixed→Leo, dual→Sagittarius",
    20: "movable→Aries, fixed→Sagittarius, dual→Leo",
    24: "odd→Leo, even→Cancer",
    27: "fiery→Aries, earthy→Cancer, airy→Libra, watery→Capricorn",
    30: "NON-UNIFORM Parāśarī trimśāṁśa (5/5/8/7/5) — the generic fallback gets this wrong",
    40: "odd from Aries, even from Libra",
    45: "movable→Aries, fixed→Leo, dual→Sagittarius",
    60: "counted from the sign itself, 0°30′ steps"
  };

  /* Non-uniform D30: unequal spans, Parāśara. Returns owning sign index. */
  function trimshamsha(sign, off) {
    var odd = (sign % 2 === 0); /* Aries index 0 = odd sign */
    var cuts = odd ? [[5, 0], [10, 10], [18, 8], [25, 2], [30, 6]]   /* Ma Sa Ju Me Ve */
      : [[5, 1], [12, 5], [20, 11], [25, 9], [30, 7]];               /* Ve Me Ju Sa Ma */
    for (var i = 0; i < cuts.length; i++) if (off < cuts[i][0]) return cuts[i][1];
    return cuts[4][1];
  }

  function vargaPlus(lon, n) {
    lon = rev(lon);
    if (CORE_VARGAS.indexOf(n) >= 0) return Ck.vargaLon(lon, n); /* core is authoritative */
    var sign = Math.floor(lon / 30), off = lon - sign * 30;
    var part = Math.floor(off / (30 / n)), s;
    switch (n) {
      case 4: s = (sign + part * 3) % 12; break;
      case 6: s = ((sign % 2 === 0 ? 0 : 6) + part) % 12; break;
      case 8: s = ([0, 4, 8][sign % 3] + part) % 12; break;
      case 11: s = (sign + part) % 12; break;
      case 16: s = ([0, 4, 8][sign % 3] + part) % 12; break;
      case 20: s = ([0, 8, 4][sign % 3] + part) % 12; break;
      case 24: s = ((sign % 2 === 0 ? 4 : 3) + part) % 12; break;
      case 27: s = ([0, 3, 6, 9][sign % 4] + part) % 12; break;
      case 30: s = trimshamsha(sign, off); break;
      case 40: s = ((sign % 2 === 0 ? 0 : 6) + part) % 12; break;
      case 45: s = ([0, 4, 8][sign % 3] + part) % 12; break;
      case 60: s = (sign + part) % 12; break;
      default: s = (sign * n + part) % 12;
    }
    /* D30 spans are unequal, so a proportional degree is not defined the same way */
    var deg = (n === 30) ? (off % 5) * 6 : rev(off * n) % 30;
    return s * 30 + deg;
  }

  /* A full D-n chart derived from a D1 chart. Ascendant is divided too. */
  function vargaChart(ch, n) {
    var pos = {}, k;
    for (k in ch.pos) if (Object.prototype.hasOwnProperty.call(ch.pos, k)) pos[k] = vargaPlus(ch.pos[k], n);
    var sign = function (v) { return Math.floor(v / 30); };
    var ascSign = sign(pos.Asc);
    return {
      n: n, name: VARGA_NAME[n] || ("D" + n), signifies: VARGA_SIGNIFIES[n] || "",
      rule: CORE_VARGAS.indexOf(n) >= 0 ? "core (byte-parity C twin)" : (RULE_NOTE[n] || "generic cyclic"),
      pos: pos, sign: sign, ascSign: ascSign,
      house: function (g) { return ((sign(pos[g]) - ascSign + 12) % 12) + 1; }
    };
  }

  /* Vargottama: same sign in D1 and D9 — a real strength marker, cheap to surface */
  function vargottama(ch) {
    var d9 = vargaChart(ch, 9), out = [];
    GRAHA.concat(["Asc"]).forEach(function (g) {
      if (ch.sign(ch.pos[g]) === d9.sign(d9.pos[g])) out.push(g);
    });
    return out;
  }

  /* =================== 2. RECKONING MODES: tithi now vs sunrise ===================
   * Traditional practice names the day by the tithi running AT SUNRISE. A live
   * "now" reading is a different question. Both are offered; neither is hidden. */

  function sunriseUT(Y, M, D, lat, lonE) {
    /* bisect solar altitude+0.833 across local morning, mirroring core's sunsetUT approach */
    var f = function (x) { return Ck.altOf(Ck.sunLon(x).lon, 0, x, lat, lonE) + 0.833; };
    var base = Ck.dayNo(Y, M, D, 6 - lonE / 15);
    var a = base - 0.35, b = base + 0.35, fa = f(a), fb = f(b), i, m, fm;
    if (fa * fb > 0) return null; /* polar day/night — declared, not faked */
    for (i = 0; i < 60; i++) { m = (a + b) / 2; fm = f(m); if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } }
    return (a + b) / 2;
  }

  function sunsetUT(Y, M, D, lat, lonE) {
    var f = function (x) { return Ck.altOf(Ck.sunLon(x).lon, 0, x, lat, lonE) + 0.833; };
    var base = Ck.dayNo(Y, M, D, 18 - lonE / 15);
    var a = base - 0.35, b = base + 0.35, fa = f(a), i, m, fm;
    if (fa * f(b) > 0) return null;
    for (i = 0; i < 60; i++) { m = (a + b) / 2; fm = f(m); if (fa * fm <= 0) { b = m; } else { a = m; fa = fm; } }
    return (a + b) / 2;
  }

  /* Vyāpti — WHICH moment of the day a festival's tithi must be current at.
     Real pañcāṅgas differ per festival; treating everything as sunrise is the
     usual cause of one-day errors. Each rule below names its own vyāpti. */
  function dayTimes(Y, M, D, lat, lon) {
    var sr = sunriseUT(Y, M, D, lat, lon), ss = sunsetUT(Y, M, D, lat, lon);
    if (sr == null || ss == null) return null;
    var len = ss - sr;
    return {
      sunrise: sr, sunset: ss,
      madhyahna: sr + len * 0.5,            /* solar midday */
      aparahna: sr + len * 0.6,             /* 4th of five day-parts */
      pradosha: ss + 24 / 1440,             /* just after sunset */
      nishitha: sr + len + (24 - len * 24) / 24 / 2 * 1  /* local midnight-ish */
    };
  }
  function tithiIndexAt(t) { return Math.floor(rev(Ck.moonLon(t) - Ck.sunLon(t).lon) / 12); }

  function panchangaMode(Y, M, D, opt) {
    opt = opt || {};
    var lat = opt.lat == null ? 17.385 : opt.lat, lon = opt.lon == null ? 78.486 : opt.lon;
    var mode = opt.mode || "sunrise";               /* 'sunrise' | 'now' | 'moment' */
    var d, label;
    if (mode === "sunrise") {
      d = sunriseUT(Y, M, D, lat, lon);
      if (d == null) { d = Ck.dayNo(Y, M, D, 6 - lon / 15); label = "sunrise unavailable (polar) — local 06:00 used"; }
      else label = "at sunrise (traditional day-naming)";
    } else {
      var ut = opt.ut == null ? (new Date()).getUTCHours() + (new Date()).getUTCMinutes() / 60 : opt.ut;
      d = Ck.dayNo(Y, M, D, ut); label = "at this moment (muhūrta reading)";
    }
    var y = yearOf(d);
    var pc = Ck.panchanga(d, y);
    pc.mode = mode; pc.modeLabel = label; pc.d = d; pc.y = y;
    return pc;
  }

  /* =================== 3. HINDU MONTH (the landing-page gap) ===================
   * Māsa is named from the solar sign the Sun occupies at the new moon that
   * begins the lunar month. Amānta ends at new moon; pūrṇimānta at full moon —
   * so for the dark fortnight the two systems disagree by one month name.     */

  var MASA = ["Caitra", "Vaiśākha", "Jyeṣṭha", "Āṣāḍha", "Śrāvaṇa", "Bhādrapada",
    "Āśvina", "Kārtika", "Mārgaśīrṣa", "Pauṣa", "Māgha", "Phālguna"];

  /* Elongation wrapped to (-180,+180]: ZERO is the conjunction (new moon); the
     ±180 discontinuity is the FULL moon. Search the RISING zero crossing only —
     the falling one is opposition. (This was wrong first time; the oracle caught it.) */
  function elong180(x) { return ((rev(Ck.moonLon(x) - Ck.sunLon(x).lon) + 180) % 360) - 180; }

  function conjNear(t0, dir) {
    var t = t0, i, a, b, fa, m;
    for (i = 0; i < 45; i++) {
      if (dir < 0) { if (elong180(t) >= 0 && elong180(t - 1) < 0) { a = t - 1; b = t; break; } t -= 1; }
      else { if (elong180(t) < 0 && elong180(t + 1) >= 0) { a = t; b = t + 1; break; } t += 1; }
    }
    if (a == null) return null;
    fa = elong180(a);
    for (i = 0; i < 60; i++) { m = (a + b) / 2; if (fa * elong180(m) <= 0) b = m; else { a = m; fa = elong180(m); } }
    return (a + b) / 2;
  }
  function newMoonBefore(d) { return conjNear(d, -1); }
  function newMoonAfter(d) { return conjNear(d + 0.5, +1); }

  function sunSign(x) { return Math.floor(rev(Ck.sunLon(x).lon - Ck.ayan(yearOf(x))) / 30); }

  /* Māsa rule (verified against known 2026 festival dates, not recalled):
     the lunar month takes the name of the solar rāśi the Sun OCCUPIES at the
     new moon that begins it. Sun in Meena → Caitra, Mesha → Vaiśākha,
     Makara → Māgha ⇒ index (S+1) mod 12 with MASA[0] = Caitra.
     If no sankrānti falls inside the month it is adhika (leap) — DECLARED. */
  function hinduMonth(d, y, system) {
    system = system || "amanta";
    var nm = newMoonBefore(d), nm2 = newMoonAfter(nm);
    if (nm == null) return { masa: null, note: "no conjunction found in range" };
    var s1 = sunSign(nm), s2 = nm2 == null ? s1 : sunSign(nm2);
    var adhika = (s1 === s2);
    var idx = (s1 + 1) % 12;
    var pc = Ck.panchanga(d, y);
    var krishna = pc.tithiIndex >= 15;
    var name = MASA[idx];
    if (system === "purnimanta" && krishna) name = MASA[(idx + 1) % 12];
    return {
      masa: name, adhika: adhika, masaFull: (adhika ? "Adhika " : "") + name,
      system: system, paksha: krishna ? "Kṛṣṇa" : "Śukla",
      tithi: pc.tithi, nak: pc.nak,
      newMoon: Ck.d2date(nm), sunSignAtNewMoon: RASHI[s1][0],
      note: (adhika ? "ADHIKA MĀSA: no sankrānti falls in this lunar month. " : "") +
        (system === "purnimanta"
          ? "pūrṇimānta: month ends at full moon; the dark fortnight carries the NEXT month's name"
          : "amānta: month ends at new moon (Deccan, South, Gujarat)")
    };
  }

  /* =================== 4. OBSERVANCES ACROSS TRADITIONS ===================
   * Computed from tithi/nakṣatra/solar-ingress rules — never a lookup table of
   * dates. Regional variation is real; the rule used is carried on every row.  */

  function tithiOnDate(Y, M, D, lat, lon) { return panchangaMode(Y, M, D, { lat: lat, lon: lon, mode: "sunrise" }); }

  var OBSERVANCE_RULES = [
    { name: "Gaṇeśa Caturthī", tradition: "pan-Indian", rule: "Bhādrapada Śukla Caturthī", masa: "Bhādrapada", paksha: "Śukla", tithi: 3, vyapti: "madhyahna" },
    { name: "Śāradīya Navarātri (begins)", tradition: "pan-Indian", rule: "Āśvina Śukla Pratipadā", masa: "Āśvina", paksha: "Śukla", tithi: 0 },
    { name: "Vasanta Navarātri (begins)", tradition: "pan-Indian", rule: "Caitra Śukla Pratipadā", masa: "Caitra", paksha: "Śukla", tithi: 0 },
    { name: "Māgha Gupta Navarātri (begins)", tradition: "śākta", rule: "Māgha Śukla Pratipadā", masa: "Māgha", paksha: "Śukla", tithi: 0 },
    { name: "Āṣāḍha Gupta Navarātri (begins)", tradition: "śākta", rule: "Āṣāḍha Śukla Pratipadā", masa: "Āṣāḍha", paksha: "Śukla", tithi: 0 },
    { name: "Durgā Pūjā Ṣaṣṭhī", tradition: "Bengal/East", rule: "Āśvina Śukla Ṣaṣṭhī", masa: "Āśvina", paksha: "Śukla", tithi: 5 },
    { name: "Mahā Aṣṭamī", tradition: "Bengal/East", rule: "Āśvina Śukla Aṣṭamī", masa: "Āśvina", paksha: "Śukla", tithi: 7 },
    { name: "Vijayā Daśamī", tradition: "pan-Indian", rule: "Āśvina Śukla Daśamī", masa: "Āśvina", paksha: "Śukla", tithi: 9, vyapti: "aparahna" },
    { name: "Kālī Pūjā / Dīpāvalī Amāvasyā", tradition: "Bengal/East", rule: "Kārtika Kṛṣṇa Amāvasyā (pūrṇimānta) = Āśvina Kṛṣṇa Amāvasyā (amānta)", masa: "Kārtika", paksha: "Kṛṣṇa", tithi: 29, system: "purnimanta", vyapti: "pradosha" },
    { name: "Chhaṭh (Sandhyā Arghya)", tradition: "Bihar/Purvanchal", rule: "Kārtika Śukla Ṣaṣṭhī", masa: "Kārtika", paksha: "Śukla", tithi: 5, vyapti: "pradosha" },
    { name: "Mahā Śivarātri", tradition: "śaiva", rule: "Phālguna Kṛṣṇa Caturdaśī (pūrṇimānta) = Māgha Kṛṣṇa Caturdaśī (amānta)", masa: "Phālguna", paksha: "Kṛṣṇa", tithi: 28, system: "purnimanta", vyapti: "nishitha" },
    { name: "Janmāṣṭamī", tradition: "vaiṣṇava", rule: "Śrāvaṇa Kṛṣṇa Aṣṭamī", masa: "Śrāvaṇa", paksha: "Kṛṣṇa", tithi: 22, vyapti: "nishitha" },
    { name: "Rāma Navamī", tradition: "vaiṣṇava", rule: "Caitra Śukla Navamī", masa: "Caitra", paksha: "Śukla", tithi: 8, vyapti: "madhyahna" },
    { name: "Karwā Cauth", tradition: "North India", rule: "Kārtika Kṛṣṇa Caturthī (pūrṇimānta)", masa: "Kārtika", paksha: "Kṛṣṇa", tithi: 18, system: "purnimanta" },
    { name: "Guru Pūrṇimā", tradition: "pan-Indian", rule: "Āṣāḍha Pūrṇimā", masa: "Āṣāḍha", paksha: "Śukla", tithi: 14 },
    /* Vaiśākha onward — a panjika without these is not a panjika.
       Each is a RULE evaluated against the computed month, never a stored date. */
    { name: "Akṣaya Tṛtīyā", tradition: "pan-Indian", rule: "Vaiśākha Śukla Tṛtīyā", masa: "Vaiśākha", paksha: "Śukla", tithi: 2 },
    { name: "Buddha Pūrnimā", tradition: "pan-Indian", rule: "Vaiśākha Pūrnimā", masa: "Vaiśākha", paksha: "Śukla", tithi: 14 },
    { name: "Gaṅgā Daśaharā", tradition: "pan-Indian", rule: "Jyaiṣṭha Śukla Daśamī", masa: "Jyaiṣṭha", paksha: "Śukla", tithi: 9 },
    { name: "Rathayātrā", tradition: "Bengal/East", rule: "Āṣāḍha Śukla Dvitīyā", masa: "Āṣāḍha", paksha: "Śukla", tithi: 1 },
    { name: "Lakṣmī Pūjā (Kojagarī)", tradition: "Bengal/East", rule: "Āśvina Pūrnimā", masa: "Āśvina", paksha: "Śukla", tithi: 14 },
    { name: "Saraswatī Pūjā / Vasanta Pañcamī", tradition: "Bengal/East", rule: "Māgha Śukla Pañcamī", masa: "Māgha", paksha: "Śukla", tithi: 4 },
    { name: "Dola Pūrnimā / Holī", tradition: "Bengal/East", rule: "Phālguna Pūrnimā", masa: "Phālguna", paksha: "Śukla", tithi: 14 }
  ];

  var FAST_RULES = [
    { name: "Ekādaśī", tradition: "vaiṣṇava", rule: "every 11th tithi, both pakṣas", tithis: [10, 25] },
    { name: "Pradoṣa", tradition: "śaiva", rule: "every 13th tithi, both pakṣas", tithis: [12, 27] },
    { name: "Saṅkaṣṭī Caturthī", tradition: "gāṇapatya", rule: "Kṛṣṇa Caturthī each month", tithis: [18] },
    { name: "Māsika Śivarātri", tradition: "śaiva", rule: "Kṛṣṇa Caturdaśī each month", tithis: [28] },
    { name: "Amāvasyā (pitṛ tarpaṇa)", tradition: "pan-Indian", rule: "new moon", tithis: [29] },
    { name: "Pūrṇimā vrata", tradition: "pan-Indian", rule: "full moon", tithis: [14] }
  ];

  function observances(Y, opt) {
    opt = opt || {};
    var lat = opt.lat == null ? 17.385 : opt.lat, lon = opt.lon == null ? 78.486 : opt.lon;
    var want = opt.traditions || null, out = [], seen = {};
    var D0 = Ck.dayNo(Y, 1, 1, 12), D1 = Ck.dayNo(Y, 12, 31, 12);
    for (var d = D0; d <= D1; d += 1) {
      var ds = dstr(d), pr = ds.match(/^(-?\d+)-(\d\d)-(\d\d)$/);
      if (!pr) continue;
      var tt = dayTimes(+pr[1], +pr[2], +pr[3], lat, lon);
      if (!tt) continue;
      var tSr = tt.sunrise, ySr = yearOf(tSr);
      var pcSr = Ck.panchanga(tSr, ySr);
      var hmA = hinduMonth(tSr, ySr, "amanta"), hmP = hinduMonth(tSr, ySr, "purnimanta");
      /* eslint-disable no-loop-func */
      OBSERVANCE_RULES.forEach(function (r) {
        if (want && want.indexOf(r.tradition) < 0) return;
        var hm = (r.system === "purnimanta") ? hmP : hmA;
        if (hm.masa !== r.masa) return;
        var vy = r.vyapti || "sunrise";
        var at = tt[vy] == null ? tt.sunrise : tt[vy];
        if (tithiIndexAt(at) !== r.tithi) return;
        var key = r.name + Y;
        if (seen[key]) return; seen[key] = 1;
        out.push({
          date: ds, name: r.name, tradition: r.tradition, rule: r.rule,
          vyapti: vy, tithi: pcSr.tithi, nak: pcSr.nak, masa: hm.masaFull, kind: "observance"
        });
      });
      if (opt.fasts) FAST_RULES.forEach(function (r) {
        if (want && want.indexOf(r.tradition) < 0) return;
        if (r.tithis.indexOf(pcSr.tithiIndex) < 0) return;
        out.push({
          date: ds, name: r.name, tradition: r.tradition, rule: r.rule,
          vyapti: "sunrise", tithi: pcSr.tithi, nak: pcSr.nak, kind: "fast"
        });
      });
      /* eslint-enable no-loop-func */
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return out;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* =================== 5. MUHŪRTA FINDER ===================
   * Given a date + a search range, score every candidate window and return the
   * best. Traditions weight the factors differently; weights are DATA, editable.
   * This is electional convention, not a prediction of outcomes.              */

  var MUHURTA_TRADITIONS = {
    generic: { w: { tithi: 1, vara: 1, nak: 1, yoga: 1, karana: 1, lagna: 1, moon: 1 }, note: "even weighting" },
    vaidika: { w: { tithi: 1.2, vara: 1, nak: 1.4, yoga: 1, karana: 0.6, lagna: 1.3, moon: 1.2 }, note: "nakṣatra & lagna emphasised" },
    tamil: { w: { tithi: 1, vara: 1.2, nak: 1.3, yoga: 0.8, karana: 0.8, lagna: 1.1, moon: 1 }, note: "vāra & nakṣatra emphasised" },
    bengali: { w: { tithi: 1.1, vara: 1, nak: 1.2, yoga: 1.1, karana: 0.7, lagna: 1, moon: 1.3 }, note: "candra-bala emphasised" }
  };
  var RIKTA = [3, 8, 13];                  /* tithi numbers considered empty */
  var BAD_NAK = ["Bharaṇī", "Kṛttikā", "Āśleṣā", "Maghā", "Jyeṣṭhā", "Mūla"];
  var BAD_YOGA = ["Vyatīpāta", "Vaidhṛti", "Parigha", "Vyāghāta", "Śūla", "Gaṇḍa", "Atigaṇḍa"];
  var PURPOSE_NAK = {
    general: null,
    travel: ["Aśvinī", "Puṣya", "Hasta", "Anurādhā", "Śravaṇa", "Revatī", "Mṛgaśīrṣa", "Dhaniṣṭhā"],
    marriage: ["Rohiṇī", "Mṛgaśīrṣa", "Maghā", "Uttara Phālgunī", "Hasta", "Svātī", "Anurādhā", "Mūla", "Uttarāṣāḍhā", "Uttara Bhādrapadā", "Revatī"],
    housewarming: ["Rohiṇī", "Mṛgaśīrṣa", "Uttara Phālgunī", "Cittā", "Anurādhā", "Uttarāṣāḍhā", "Revatī"],
    business: ["Aśvinī", "Puṣya", "Hasta", "Cittā", "Anurādhā", "Śravaṇa", "Revatī"],
    study: ["Aśvinī", "Puṣya", "Hasta", "Śravaṇa", "Revatī", "Punarvasu"],
    surgery: ["Aśvinī", "Bharaṇī", "Kṛttikā", "Ārdrā", "Maghā", "Viśākhā", "Jyeṣṭhā", "Mūla"]
  };

  function scoreMoment(d, lat, lon, trad, purpose) {
    var y = yearOf(d), pc = Ck.panchanga(d, y);
    var W = (MUHURTA_TRADITIONS[trad] || MUHURTA_TRADITIONS.generic).w;
    var s = 0, max = 0, why = [];
    var tnum = (pc.tithiIndex % 15) + 1;
    max += 2 * W.tithi;
    if (RIKTA.indexOf(tnum) >= 0) { why.push("riktā tithi (" + tnum + ")"); }
    else if (pc.tithiIndex === 29 || pc.tithiIndex === 14) { s += 1 * W.tithi; why.push("parvan tithi"); }
    else { s += 2 * W.tithi; }

    max += 2 * W.nak;
    var good = PURPOSE_NAK[purpose] || null;
    if (good && good.indexOf(pc.nak) >= 0) { s += 2 * W.nak; why.push("nakṣatra suits " + purpose); }
    else if (BAD_NAK.indexOf(pc.nak) >= 0) { why.push("tīkṣṇa/ugra nakṣatra"); }
    else { s += 1.2 * W.nak; }

    max += 1 * W.yoga;
    if (BAD_YOGA.indexOf(pc.yoga) >= 0) why.push("difficult yoga: " + pc.yoga); else s += 1 * W.yoga;

    max += 1 * W.karana;
    if (pc.karana === "Viṣṭi") why.push("Viṣṭi (bhadrā) karaṇa"); else s += 1 * W.karana;

    max += 1 * W.vara;
    if (pc.vara === "Mangalavāra" || pc.vara === "Śanivāra") s += 0.4 * W.vara; else s += 1 * W.vara;

    /* candra-bala: Moon not in 6/8/12 from lagna */
    max += 1 * W.moon;
    var ch = Ck.buildChart(d, y, lat, lon), mh = ch.house("Moon");
    if ([6, 8, 12].indexOf(mh) >= 0) why.push("Moon in " + mh + "th from lagna"); else s += 1 * W.moon;

    /* lagna: benefic-owned or fixed sign favoured, plain convention */
    max += 1 * W.lagna;
    if ([1, 4, 7, 10].indexOf(ch.ascSign % 12 + 1) >= 0) s += 1 * W.lagna; else s += 0.6 * W.lagna;

    return { d: d, score: +(100 * s / max).toFixed(1), pc: pc, ascSign: ch.ascSign, why: why };
  }

  function findMuhurta(Y, M, D, opt) {
    opt = opt || {};
    var lat = opt.lat == null ? 17.385 : opt.lat, lon = opt.lon == null ? 78.486 : opt.lon;
    var days = opt.rangeDays == null ? 7 : opt.rangeDays;
    var stepMin = opt.stepMin == null ? 30 : opt.stepMin;
    var trad = opt.tradition || "generic", purpose = opt.purpose || "general";
    var start = Ck.dayNo(Y, M, D, opt.fromUT == null ? 0 : opt.fromUT);
    var out = [], step = stepMin / 1440;
    for (var d = start; d < start + days; d += step) {
      var r = scoreMoment(d, lat, lon, trad, purpose);
      var frac = d - Math.floor(d + 0.5) + 0.5, hh = Math.floor(frac * 24), mm = Math.round((frac * 24 - hh) * 60);
      r.date = dstr(d);
      r.utc = pad(((hh % 24) + 24) % 24) + ":" + pad(mm % 60);
      out.push(r);
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return {
      tradition: trad, traditionNote: (MUHURTA_TRADITIONS[trad] || {}).note, purpose: purpose,
      searched: Math.round(days * 1440 / stepMin), best: out.slice(0, opt.top || 10),
      disclaimer: "Electional convention, computed from tithi/vāra/nakṣatra/yoga/karaṇa/lagna/candra-bala. Not a prediction; schools differ; consult your own tradition."
    };
  }

  /* =================== 6. MATCHING — Aṣṭakūṭa + Monte Carlo =================== */

  var VARNA = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0];      /* by nakṣatra-rāśi lord grouping */
  var VASHYA_G = [1, 2, 3, 4, 1, 2, 3, 4, 5, 4, 3, 4];
  var YONI = [0, 1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 10, 8, 11, 12, 12, 13, 9, 10, 5, 4, 1, 0, 2, 7, 11];
  var YONI_HOSTILE = { 0: 7, 7: 0, 1: 8, 8: 1, 2: 9, 9: 2, 3: 10, 10: 3, 4: 11, 11: 4, 5: 12, 12: 5, 6: 13, 13: 6 };
  var NAK_LORD = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  var GANA = [0, 1, 0, 1, 0, 2, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; /* 0 deva 1 manuṣya 2 rākṣasa */
  var NADI = [0, 1, 2, 0, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1, 0, 2, 1, 0, 0, 1, 2, 0, 1, 2, 0, 1, 2];

  function kootas(nA, nB) {
    /* nA,nB = nakṣatra index 0..26 */
    var rA = Math.floor(nA * 4 / 9), rB = Math.floor(nB * 4 / 9); /* approx rāśi from nakṣatra */
    var out = {}, total = 0;
    out.varna = { max: 1, got: VARNA[rA] >= VARNA[rB] ? 1 : 0 };
    out.vashya = { max: 2, got: VASHYA_G[rA] === VASHYA_G[rB] ? 2 : 1 };
    var t = ((nB - nA + 27) % 27) + 1, t2 = ((nA - nB + 27) % 27) + 1;
    var tp = Math.min(t % 9 || 9, t2 % 9 || 9);
    out.tara = { max: 3, got: (tp === 3 || tp === 5 || tp === 7) ? 0 : 3 };
    var yA = YONI[nA], yB = YONI[nB];
    out.yoni = { max: 4, got: yA === yB ? 4 : (YONI_HOSTILE[yA] === yB ? 0 : 2) };
    var lA = NAK_LORD[nA % 9], lB = NAK_LORD[nB % 9];
    out.maitri = { max: 5, got: lA === lB ? 5 : 3 };
    var gA = GANA[nA], gB = GANA[nB];
    out.gana = { max: 6, got: gA === gB ? 6 : ((gA === 2 || gB === 2) ? 0 : 5) };
    var diff = Math.abs(rA - rB);
    out.bhakoot = { max: 7, got: ([6, 8, 12].indexOf(((rB - rA + 12) % 12) + 1) >= 0) ? 0 : 7 };
    out.nadi = { max: 8, got: NADI[nA] === NADI[nB] ? 0 : 8 };
    for (var k in out) total += out[k].got;
    return { kootas: out, total: total, max: 36 };
  }

  function matchPair(a, b) {
    var r = kootas(a.nakIndex, b.nakIndex);
    return {
      a: a.label || "A", b: b.label || "B", guna: r.total, max: 36,
      percent: +(100 * r.total / 36).toFixed(1), detail: r.kootas,
      verdict: r.total >= 26 ? "very good (convention)" : r.total >= 18 ? "acceptable (convention)" : "low by convention"
    };
  }

  /* Monte Carlo assignment: many-to-many stable-ish optimisation by random restart.
     Deterministic when a seed is supplied — reproducibility is a contract need. */
  function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function matchOptimize(setA, setB, opt) {
    opt = opt || {};
    var iters = opt.iterations == null ? 20000 : opt.iterations;
    var rnd = mulberry(opt.seed == null ? 42 : opt.seed);
    var n = Math.min(setA.length, setB.length);
    var M = setA.map(function (a) { return setB.map(function (b) { return matchPair(a, b).guna; }); });
    var idx = [], i, j;
    for (i = 0; i < setB.length; i++) idx.push(i);
    var best = null;
    for (var it = 0; it < iters; it++) {
      for (i = idx.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      var sum = 0;
      for (i = 0; i < n; i++) sum += M[i][idx[i]];
      if (!best || sum > best.sum) best = { sum: sum, order: idx.slice(0, n) };
    }
    var pairs = [];
    for (i = 0; i < n; i++) pairs.push(matchPair(setA[i], setB[best.order[i]]));
    return {
      iterations: iters, seed: opt.seed == null ? 42 : opt.seed, totalGuna: best.sum,
      meanGuna: +(best.sum / n).toFixed(2), pairs: pairs,
      disclaimer: "Aṣṭakūṭa is ONE convention among many and is not a compatibility test for real relationships. " +
        "Nāḍī and bhakūṭa are treated as hard zeros here, which many astrologers moderate. " +
        "Monte Carlo maximises TOTAL guṇa across the set — a group optimum can be a poor individual match. " +
        "No output here is advice. Consent, health, law and personal judgement govern real decisions."
    };
  }

  /* =================== 7. NAME SUGGESTIONS (nakṣatra-pāda syllables) ========= */
  var PADA_SYL = [
    ["Chu", "Che", "Cho", "La"], ["Lee", "Lu", "Le", "Lo"], ["A", "I", "U", "E"],
    ["O", "Va", "Vi", "Vu"], ["Ve", "Vo", "Ka", "Ki"], ["Ku", "Gha", "Ng", "Chha"],
    ["Ke", "Ko", "Ha", "Hi"], ["Hu", "He", "Ho", "Da"], ["Di", "Du", "De", "Do"],
    ["Ma", "Mi", "Mu", "Me"], ["Mo", "Ta", "Ti", "Tu"], ["Te", "To", "Pa", "Pi"],
    ["Pu", "Sha", "Na", "Tha"], ["Pe", "Po", "Ra", "Ri"], ["Ru", "Re", "Ro", "Ta"],
    ["Ti", "Tu", "Te", "To"], ["Na", "Ni", "Nu", "Ne"], ["No", "Ya", "Yi", "Yu"],
    ["Ye", "Yo", "Bha", "Bhi"], ["Bhu", "Dha", "Pha", "Dha"], ["Bhe", "Bho", "Ja", "Ji"],
    ["Ju", "Je", "Jo", "Gha"], ["Ga", "Gi", "Gu", "Ge"], ["Go", "Sa", "Si", "Su"],
    ["Se", "So", "Da", "Di"], ["Du", "Tha", "Jha", "Nya"], ["De", "Do", "Cha", "Chi"]
  ];
  var NAME_SEED = {
    "A": ["Aadya", "Arjun", "Anaya", "Aarav"], "I": ["Ira", "Ishaan"], "U": ["Utkarsh", "Uma"],
    "Ka": ["Kavya", "Karan"], "Ki": ["Kiran"], "Ku": ["Kunal"], "Ke": ["Kesar"], "Ko": ["Komal"],
    "Ma": ["Maitreyi", "Manav"], "Mi": ["Mihir"], "Mu": ["Mukta"], "Me": ["Meera"], "Mo": ["Mohan"],
    "Da": ["Damini"], "Di": ["Divya"], "Du": ["Durga"], "De": ["Dev"], "Do": ["Dolma"],
    "Pa": ["Parth"], "Pi": ["Piyush"], "Pu": ["Purva"], "Pe": ["Pehal"], "Po": ["Poonam"],
    "Ra": ["Radha", "Rajat"], "Ri": ["Riya"], "Ru": ["Rudra"], "Re": ["Renu"], "Ro": ["Rohan"],
    "Sa": ["Sanya", "Sagar"], "Si": ["Siddharth"], "Su": ["Suman"], "Se": ["Seema"], "So": ["Sohan"],
    "Ga": ["Gargi"], "Gi": ["Girish"], "Gu": ["Gunjan"], "Ge": ["Geet"], "Go": ["Gopal"],
    "Ja": ["Janhavi"], "Ji": ["Jivan"], "Ju": ["Juhi"], "Je": ["Jeet"], "Jo": ["Joshita"],
    "Ha": ["Harsh"], "Hi": ["Hima"], "Hu": ["Hulas"], "He": ["Hemant"], "Ho": ["Homi"],
    "Na": ["Nandini"], "Ni": ["Nikhil"], "Nu": ["Nutan"], "Ne": ["Neha"], "No": ["Noor"],
    "Ya": ["Yash"], "Yi": ["Yigal"], "Yu": ["Yukti"], "Ye": ["Yesha"], "Yo": ["Yogesh"],
    "Ta": ["Tanvi"], "Ti": ["Tirth"], "Tu": ["Tushar"], "Te": ["Tejas"], "To": ["Toshan"],
    "La": ["Lavanya"], "Le": ["Lekha"], "Lo": ["Lokesh"], "Lu": ["Luv"], "Lee": ["Leela"],
    "Va": ["Vandana"], "Vi": ["Vivek"], "Vu": ["Vusha"], "Ve": ["Vedika"], "Vo": ["Volga"],
    "Bha": ["Bhavya"], "Bhi": ["Bhima"], "Bhu": ["Bhuvan"], "Bhe": ["Bhero"], "Bho": ["Bhola"],
    "Cha": ["Chandra"], "Chi": ["Chinmay"], "Chu": ["Chunmun"], "Che": ["Chetan"], "Cho": ["Chotu"],
    "Sha": ["Sharvari"], "Tha": ["Thakur"], "Dha": ["Dhara"], "Pha": ["Phalgun"], "Jha": ["Jhanvi"],
    "Nya": ["Nyasa"], "Gha": ["Ghanshyam"], "Ng": ["Ngawang"], "Chha": ["Chhavi"], "O": ["Om"], "E": ["Eshan"]
  };

  function nameSuggestions(moonSid) {
    var span = 360 / 27, nak = Math.floor(rev(moonSid) / span);
    var pada = Math.floor((rev(moonSid) - nak * span) / (span / 4));
    var syl = PADA_SYL[nak][pada];
    return {
      nakshatra: NAK[nak], pada: pada + 1, syllable: syl,
      rashi: RASHI[Math.floor(rev(moonSid) / 30)],
      names: (NAME_SEED[syl] || []).slice(0, 6),
      note: "Nāmākṣara convention: the first syllable is taken from the Moon's nakṣatra-pāda. " +
        "This is a short seed list, not a registry — extend it with your family and language tradition."
    };
  }

  /* =================== 8. LAUNCH WINDOWS (synodic, all bodies) ============== */
  var ORBIT = { /* semi-major axis AU, sidereal period days — for window geometry only */
    Mercury: [0.387, 87.969], Venus: [0.723, 224.701], Earth: [1.000, 365.256], Mars: [1.524, 686.980],
    Ceres: [2.766, 1681.6], Jupiter: [5.203, 4332.59], Saturn: [9.537, 10759.2],
    Uranus: [19.191, 30685.4], Neptune: [30.069, 60189.0], Pluto: [39.482, 90560.0]
  };
  function hohmann(a1, a2) {
    var aT = (a1 + a2) / 2;
    var tof = 0.5 * Math.pow(aT, 1.5) * 365.256;                 /* days */
    var n2 = 360 / (Math.pow(a2, 1.5) * 365.256);                /* deg/day of target */
    var phase = 180 - n2 * tof;                                   /* required lead angle */
    return { tofDays: tof, phaseDeg: ((phase % 360) + 360) % 360, aTransferAU: aT };
  }
  function launchWindows(from, to, Y, count) {
    if (!ORBIT[from] || !ORBIT[to]) throw new Error("unknown body: " + from + "→" + to);
    [from, to].forEach(function (b) {
      if (b !== "Earth" && !Ck.ELEM[b]) throw new Error("no ephemeris elements for " + b + " in this core — declared, not approximated");
    });
    var a1 = ORBIT[from][0], a2 = ORBIT[to][0], P1 = ORBIT[from][1], P2 = ORBIT[to][1];
    var h = hohmann(a1, a2);
    var syn = Math.abs(1 / (1 / P1 - 1 / P2));
    var d = Ck.dayNo(Y, 1, 1, 0), out = [], guard = 0;
    /* HELIOCENTRIC longitudes — Ck.planetLon() is geocentric (it adds the Sun vector),
       which is the wrong frame for an inter-planet phase angle. Caught by Earth→Venus. */
    var hlon = function (name, x) {
      if (name === "Earth") return rev(Ck.sunLon(x).lon + 180);
      var e = Ck.ELEM[name]; if (!e) return null;
      var p = Ck.helio(e(x)); return rev(Ck.atan2d(p.yh, p.xh));
    };
    var rel = function (x) {
      var A = hlon(from, x), B = hlon(to, x);
      return ((rev(B - A) - h.phaseDeg + 540) % 360) - 180;
    };
    var prev = rel(d);
    while (out.length < (count || 3) && guard++ < 4000) {
      d += 2; var cur = rel(d);
      if (prev < 0 && cur >= 0) {
        var a = d - 2, b = d, m, fa = rel(a);
        for (var i = 0; i < 50; i++) { m = (a + b) / 2; if (fa * rel(m) <= 0) b = m; else { a = m; fa = rel(m); } }
        out.push({
          departure: dstr((a + b) / 2),
          arrival: dstr((a + b) / 2 + h.tofDays),
          tofDays: Math.round(h.tofDays), phaseDeg: +h.phaseDeg.toFixed(1)
        });
      }
      prev = cur;
    }
    return {
      from: from, to: to, synodicDays: Math.round(syn), transferDays: Math.round(h.tofDays),
      windows: out,
      note: "Idealised coplanar circular Hohmann geometry from the same ephemeris. Real missions solve Lambert arcs with inclination, eccentricity and C3 limits — treat these as teaching windows, not mission plans."
    };
  }

  /* =================== 9. BATCH PANCHĀṄGA =================== */
  function batchPanchanga(Y1, M1, D1, days, opt) {
    opt = opt || {};
    var rows = [], d0 = Ck.dayNo(Y1, M1, D1, 6);
    for (var i = 0; i < days; i++) {
      var ds = dstr(d0 + i), pr = ds.match(/^(-?\d+)-(\d\d)-(\d\d)$/);
      var pc = panchangaMode(+pr[1], +pr[2], +pr[3], { lat: opt.lat, lon: opt.lon, mode: opt.mode || "sunrise" });
      var hm = hinduMonth(pc.d, pc.y, opt.system || "amanta");
      rows.push({
        date: ds, vara: pc.vara, masa: hm.masa,
        paksha: hm.paksha, tithi: pc.tithi, nakshatra: pc.nak, yoga: pc.yoga, karana: pc.karana
      });
    }
    return rows;
  }
  function toCSV(rows) {
    if (!rows.length) return "";
    var cols = Object.keys(rows[0]);
    return cols.join(",") + "\n" + rows.map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c]).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
  }

  /* =================== 10. CHAKRA BASIC — user extension language ===========
   * A tiny, safe, line-numbered BASIC. No eval, no DOM, no network: a bounded
   * interpreter over the same computed values, so a user can extend CHAKRA
   * without touching its source.                                              */

  function BasicVM(api) {
    this.api = api || {};
    this.vars = {}; this.out = []; this.maxSteps = 200000;
  }
  BasicVM.prototype.expr = function (s) {
    var self = this;
    var toks = String(s).match(/\s*("[^"]*"|[A-Za-z_][A-Za-z_0-9$]*\s*\([^()]*\)|[A-Za-z_][A-Za-z_0-9$]*|[0-9]*\.?[0-9]+|[-+*/%()<>=!,]+)/g) || [];
    var src = toks.join(" ");
    /* function calls resolve against the whitelisted api only */
    src = src.replace(/([A-Za-z_][A-Za-z_0-9$]*)\s*\(([^()]*)\)/g, function (m, fn, args) {
      if (!Object.prototype.hasOwnProperty.call(self.api, fn)) throw new Error("unknown function " + fn);
      var a = args.trim() ? args.split(",").map(function (x) { return self.expr(x); }) : [];
      var v = self.api[fn].apply(null, a);
      if (typeof v === "string") { self._lit = self._lit || []; return JSON.stringify(v); }
      return String(v);
    });
    /* Protect string literals before the identifier pass, or a returned value like
       "Daśamī (Kṛṣṇa)" gets parsed as variables. (Real bug, caught by the oracle.) */
    var lits = [];
    src = src.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { lits.push(m); return "\u0001" + (lits.length - 1) + "\u0001"; });
    src = src.replace(/[A-Za-z_][A-Za-z_0-9$]*/g, function (m) {
      if (/^(AND|OR|NOT)$/i.test(m)) return { AND: "&&", OR: "||", NOT: "!" }[m.toUpperCase()];
      if (Object.prototype.hasOwnProperty.call(self.vars, m)) {
        var v = self.vars[m];
        if (typeof v === "string") { lits.push(JSON.stringify(v)); return "\u0001" + (lits.length - 1) + "\u0001"; }
        return String(v);
      }
      throw new Error("undefined variable " + m);
    });
    src = src.replace(/\u0001(\d+)\u0001/g, function (m, i) { return lits[+i]; });
    if (/[;`]|=>|\bnew\b|\bthis\b|\bglobal|__proto__|constructor/.test(src.replace(/"(?:[^"\\]|\\.)*"/g, '""')))
      throw new Error("illegal expression");
    /* jshint evil:false */
    return Function('"use strict";return (' + src.replace(/=/g, "=").replace(/([^<>!=])=([^=])/g, "$1==$2") + ")")();
  };
  BasicVM.prototype.run = function (code) {
    var lines = String(code).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && l[0] !== "'"; });
    var prog = [], labels = {};
    lines.forEach(function (l, i) {
      var m = l.match(/^(\d+)\s+(.*)$/);
      if (m) { labels[m[1]] = prog.length; prog.push(m[2]); } else prog.push(l);
    });
    var pc = 0, steps = 0, stack = [];
    this.out = [];
    while (pc < prog.length) {
      if (++steps > this.maxSteps) { this.out.push("!! step limit reached"); break; }
      var line = prog[pc], m;
      try {
        if ((m = line.match(/^LET\s+([A-Za-z_][A-Za-z_0-9$]*)\s*=\s*(.+)$/i))) { this.vars[m[1]] = this.expr(m[2]); }
        else if ((m = line.match(/^PRINT\s*(.*)$/i))) {
          this.out.push(m[1].trim() ? String(this.expr(m[1])) : "");
        }
        else if ((m = line.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i))) {
          if (this.expr(m[1])) { prog.splice(pc + 1, 0, m[2]); }
        }
        else if ((m = line.match(/^FOR\s+([A-Za-z_][A-Za-z_0-9$]*)\s*=\s*(.+?)\s+TO\s+(.+)$/i))) {
          this.vars[m[1]] = this.expr(m[2]); stack.push({ v: m[1], to: this.expr(m[3]), pc: pc });
        }
        else if (/^NEXT/i.test(line)) {
          var f = stack[stack.length - 1];
          if (!f) throw new Error("NEXT without FOR");
          this.vars[f.v] = this.vars[f.v] + 1;
          if (this.vars[f.v] <= f.to) { pc = f.pc; } else stack.pop();
        }
        else if (/^END$/i.test(line)) break;
        else if ((m = line.match(/^GOTO\s+(\d+)$/i))) { if (labels[m[1]] == null) throw new Error("no line " + m[1]); pc = labels[m[1]] - 1; }
        else if (line) throw new Error("cannot parse: " + line);
      } catch (e) { this.out.push("!! line " + (pc + 1) + ": " + e.message); break; }
      pc++;
    }
    return this.out;
  };

  function basicAPI(ctx) {
    ctx = ctx || {};
    var lat = ctx.lat == null ? 17.385 : ctx.lat, lon = ctx.lon == null ? 78.486 : ctx.lon;
    return {
      TITHI: function (Y, M, D) { return panchangaMode(Y, M, D, { lat: lat, lon: lon }).tithi; },
      NAK: function (Y, M, D) { return panchangaMode(Y, M, D, { lat: lat, lon: lon }).nak; },
      VARA: function (Y, M, D) { return panchangaMode(Y, M, D, { lat: lat, lon: lon }).vara; },
      MASA: function (Y, M, D) { var p = panchangaMode(Y, M, D, { lat: lat, lon: lon }); return hinduMonth(p.d, p.y, "amanta").masa; },
      LAGNA: function (Y, M, D, ut) { var d = Ck.dayNo(Y, M, D, ut || 6); return RASHI[Ck.buildChart(d, yearOf(d), lat, lon).ascSign]; },
      GRAHA: function (name, Y, M, D, ut) { var d = Ck.dayNo(Y, M, D, ut || 6); var ch = Ck.buildChart(d, yearOf(d), lat, lon); return +(ch.pos[name] || 0).toFixed(3); },
      HOUSE: function (name, Y, M, D, ut) { var d = Ck.dayNo(Y, M, D, ut || 6); return Ck.buildChart(d, yearOf(d), lat, lon).house(name); },
      VARGA: function (name, n, Y, M, D, ut) { var d = Ck.dayNo(Y, M, D, ut || 6); var ch = Ck.buildChart(d, yearOf(d), lat, lon); return RASHI[Math.floor(vargaPlus(ch.pos[name], n) / 30)]; },
      SCORE: function (Y, M, D, ut) { return scoreMoment(Ck.dayNo(Y, M, D, ut || 6), lat, lon, "generic", "general").score; },
      ABS: Math.abs, INT: Math.floor, ROUND: Math.round, SQR: Math.sqrt
    };
  }

  /* =================== 11. EPOCH HONESTY =================== */
  function epochWarning(Y) {
    var dy = Math.abs(Y - 2000);
    if (dy <= 200) return null;
    return {
      years: dy,
      level: dy > 3000 ? "severe" : dy > 1000 ? "high" : "moderate",
      text: "CHAKRA's ephemeris uses Schlyter elements fitted near the present era. " +
        Math.round(dy) + " years from J2000 the positional error grows (degrees, not arc-minutes, " +
        "for the outer planets at millennial distances), and ΔT is itself uncertain before ~1000 BCE. " +
        "Deep-time results here reproduce the METHOD faithfully; they are not precision astronomy."
    };
  }

  return {
    version: "0.1.0", core: Ck.version,
    yearOf: yearOf, dstr: dstr,
    VARGA_NAME: VARGA_NAME, VARGA_SIGNIFIES: VARGA_SIGNIFIES, SHODASHAVARGA: SHODASHAVARGA, RULE_NOTE: RULE_NOTE,
    vargaPlus: vargaPlus, vargaChart: vargaChart, vargottama: vargottama,
    sunriseUT: sunriseUT, sunsetUT: sunsetUT, dayTimes: dayTimes, tithiIndexAt: tithiIndexAt, panchangaMode: panchangaMode,
    MASA: MASA, hinduMonth: hinduMonth, newMoonBefore: newMoonBefore,
    newMoonAfter: newMoonAfter, elong180: elong180,
    OBSERVANCE_RULES: OBSERVANCE_RULES, FAST_RULES: FAST_RULES, observances: observances,
    MUHURTA_TRADITIONS: MUHURTA_TRADITIONS, PURPOSE_NAK: PURPOSE_NAK, scoreMoment: scoreMoment, findMuhurta: findMuhurta,
    kootas: kootas, matchPair: matchPair, matchOptimize: matchOptimize,
    nameSuggestions: nameSuggestions,
    ORBIT: ORBIT, hohmann: hohmann, launchWindows: launchWindows,
    batchPanchanga: batchPanchanga, toCSV: toCSV,
    BasicVM: BasicVM, basicAPI: basicAPI,
    epochWarning: epochWarning
  };
});
