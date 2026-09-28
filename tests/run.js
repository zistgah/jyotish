#!/usr/bin/env node
/*
 * Jyotish test suite. Every threshold is a measured bound with headroom, not a hope.
 * Exit 0 only when every check passes.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. AyeAI.
 */
"use strict";
var fs = require("fs"), path = require("path"), crypto = require("crypto");
var ROOT = path.join(__dirname, ".."), pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else fail++; console.log((cond ? "  ok   " : "  FAIL ") + name + (detail !== undefined ? "  [" + detail + "]" : "")); }
function section(s) { console.log("\n" + s); }
function cfgFile(f) { return JSON.parse(fs.readFileSync(path.join(ROOT, "config", f), "utf8")); }
var bundle = {};
fs.readdirSync(path.join(ROOT, "config")).filter(function (f) { return f.endsWith(".json"); }).forEach(function (f) { bundle[f.replace(".config", "").replace(".json", "")] = cfgFile(f); });
var J = require("../lib/jyotish.js").create(bundle), E = J.ephem, P = J.panchang, C = J.calendar, K = J.kundali, M = J.match;
var place = function (n) { return bundle.jyotish.places.filter(function (p) { return p.name === n; })[0]; };
var ist = function (jd) { var c = E.civilFromJd(jd + 5.5 / 24); return { d: c.Y + "-" + String(c.M).padStart(2, "0") + "-" + String(c.D).padStart(2, "0"), h: c.hours }; };
var arcsec = function (a, b) { return Math.abs((((a - b) % 360) + 540) % 360 - 180) * 3600; };

section("1. The sky against an independent oracle (pyswisseph, Moshier mode), 1900 to 2100");
var O = require("./vectors/oracle.json"), worst = {};
function upd(k, v) { worst[k] = Math.max(worst[k] || 0, Math.abs(v)); }
O.positions.forEach(function (r) {
  ["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].forEach(function (b) {
    var p = E.planetApparent(b, r.jde); upd(b === "Sun" ? "Sun" : "planets", arcsec(p.lon, r[b][0])); upd("sidereal", arcsec(E.sidereal(p.lon, r.jde), r[b][2]));
  });
  var m = E.moonApparent(r.jde); upd("Moon", arcsec(m.lon, r.Moon[0])); upd("Moon sidereal", arcsec(E.sidereal(m.lon, r.jde), r.Moon[2]));
  upd("true node", arcsec(E.nodeLon(r.jde, "true") - E.nutation(r.jde).dpsi, r.trueNode));
  upd("mean node", arcsec(E.nodeLon(r.jde, "mean") - E.nutation(r.jde).dpsi, r.meanNode));
  upd("nutation", (E.nutation(r.jde).dpsi - r.dpsi) * 3600);
});
O.rise.forEach(function (q) {
  var rs = E.riseSet("Sun", q.jd0, q.lat, q.lon, -0.8333); upd("sunrise s", (rs.rise - q.sunrise) * 86400); upd("sunset s", (rs.set - q.sunset) * 86400);
  var mr = E.crossings("Moon", q.jd0, q.jd0 + 1.2, q.lat, q.lon).filter(function (c) { return c.kind === "rise"; })[0]; if (mr) upd("moonrise s", (mr.jd - q.moonrise) * 86400);
});
O.asc.forEach(function (a) { var x = E.ascendant(a.jd, a.lat, a.lon); upd("ascendant", arcsec(E.sidereal(x.asc, E.jde(a.jd)), a.ascSid)); });
var LIM = { Sun: 1, planets: 6, sidereal: 6, Moon: 15, "Moon sidereal": 15, "true node": 120, "mean node": 30, nutation: 0.1, "sunrise s": 10, "sunset s": 10, "moonrise s": 10, ascendant: 1 };
Object.keys(LIM).forEach(function (k) { ok(k + " within " + LIM[k] + (k.slice(-2) === " s" ? " s" : "″"), worst[k] <= LIM[k], (worst[k] || 0).toFixed(2)); });
var ACC = bundle.jyotish.accuracy;
ok("published bounds hold: Sun " + ACC.sun_arcsec + "″, planets " + ACC.planets_arcsec + "″, Moon " + ACC.moon_arcsec + "″", worst.Sun <= ACC.sun_arcsec && worst.planets <= ACC.planets_arcsec && worst.Moon <= ACC.moon_arcsec);
ok("published bounds hold: sidereal " + ACC.sidereal_arcsec + "″, rise and set " + ACC.rise_set_s + " s, moonrise " + ACC.moonrise_s + " s",
  worst.sidereal <= ACC.sidereal_arcsec && worst["sunrise s"] <= ACC.rise_set_s && worst["sunset s"] <= ACC.rise_set_s && worst["moonrise s"] <= ACC.moonrise_s);
ok("Delta-T 2015 July = 69.3 s (Espenak and Meeus, as pymeeus)", Math.abs(E.deltaT(E.jdFromCivil(2015, 7, 1, 0)) - 69.3) < 0.1, E.deltaT(E.jdFromCivil(2015, 7, 1, 0)).toFixed(2));
ok("Lahiri at 1956-03-21 is the ICRC true value less nutation", Math.abs(E.ayanamsha(2435553.5) + E.nutation(2435553.5).dpsi - 23.250182778) < 1e-9);

section("2. The pañcāṅga");
var nm = P.newMoonAfter(E.jdFromCivil(2003, 9, 24, 0)), nmi = ist(nm);
ok("new moon of 26 Sep 2003 inside the published minute, 08:39 IST", nmi.d === "2003-09-26" && nmi.h >= 8 + 39 / 60 && nmi.h < 8 + 40 / 60, nmi.d + " " + nmi.h.toFixed(4));
var hyd = place("Hyderabad"), d = P.day(2026, 9, 28, hyd);
ok("day of 28 Sep 2026 is Somavāra", d.vara.index === 1);
ok("samvat 2083, Śaka 1948, Kali 5127, Parābhava", d.samvat.vikram === 2083 && d.samvat.shaka === 1948 && d.samvat.kali === 5127 && d.samvat.samvatsara === "Parābhava");
ok("amānta Bhādrapada, pūrṇimānta Āśvina, Kṛṣṇa pakṣa", d.masa.amanta === "Bhādrapada" && d.masa.purnimanta === "Āśvina" && d.masa.paksha === "Kṛṣṇa");
ok("Monday choghaḍiyā by day", d.choghadiya.day.map(function (c) { return c.name; }).join(",") === "Amṛta,Kāla,Śubha,Roga,Udvega,Chara,Lābha,Amṛta");
ok("Monday choghaḍiyā by night", d.choghadiya.night.map(function (c) { return c.name; }).join(",") === "Chara,Roga,Kāla,Lābha,Udvega,Śubha,Amṛta,Chara");
ok("24 horās, first ruled by the Moon on Monday", d.hora.length === 24 && d.hora[0].lord === "Moon");
ok("Rāhu Kāla is the second eighth of daylight on Monday", Math.abs(d.segments.rahu.start - (d.sunrise + (d.sunset - d.sunrise) / 8)) < 1e-9);
ok("tithis tile the day without gaps", d.limbs.tithi.every(function (s, i, a) { return i === 0 || Math.abs(s.start - a[i - 1].end) < 1e-6; }));
ok("lagna table covers sunrise to sunrise", Math.abs(d.lagna[0].start - d.sunrise) < 1e-9 && Math.abs(d.lagna[d.lagna.length - 1].end - d.nextSunrise) < 1e-9);
var adh = P.masaAt(E.jdFromCivil(2026, 6, 1, 6)); ok("2026 carries an adhika Jyeṣṭha", adh.adhika && adh.amanta === "Adhika Jyeṣṭha", adh.amanta);

section("3. Observances against published anchors");
bundle.festivals.rules.forEach(function (r) {
  (r.anchors || []).forEach(function (a) {
    var list = C.festivals(2026, place(a.place), [r.id]).map(function (x) { return x.date; });
    var hit = a.date ? list.indexOf(a.date) >= 0 : list.some(function (g) { return g >= a.date_range[0] && g <= a.date_range[1]; });
    ok(r.id + " " + (a.date || a.date_range.join("..")) + " at " + a.place, hit, list.join(","));
  });
});
var dh = C.festivals(2026, place("Ujjain"), ["diwali-lakshmi-puja"])[0];
ok("Dīpāvalī window lies inside pradoṣa and inside Amāvāsyā", dh.windows.length && dh.windows[0].start >= dh.tithiStart && dh.windows[0].end <= dh.tithiEnd);

section("4. Śrāddha");
var pp = C.pitruPaksha(2026, place("New Delhi")), sp = {};
pp.special.forEach(function (s) { sp[s.id] = s.date; });
[["purnima-shraddha", "2026-09-26"], ["maha-bharani", "2026-09-29"], ["avidhava-navami", "2026-10-04"], ["magha-shraddha", "2026-10-07"], ["sarvapitri-amavasya", "2026-10-10"]]
  .forEach(function (x) { ok(x[0] + " = " + x[1] + " (published)", sp[x[0]] === x[1], sp[x[0]]); });
ok("Pratipadā Śrāddha 2026 = 2026-09-27 (published)", pp.days.filter(function (x) { return x.number === 1; })[0].date === "2026-09-27");
var dt = C.deathTithi({ Y: 2003, M: 9, D: 26, hours: null, place: { lat: 22.5726, lon: 88.3639, tz: 5.5 } });
ok("26 Sep 2003, hour unknown: two candidate tithis", dt.candidates.length === 2 && dt.candidates[0].tithiIndex === 29 && dt.candidates[1].tithiIndex === 0);
ok("the candidates change at the new moon, 08:39 IST", Math.abs(ist(dt.candidates[0].holdsTo).h - (8 + 39 / 60)) < 1 / 60);
var a0 = C.annualDates(dt.candidates[0], 2026, hyd).dates.map(function (x) { return x.date; }), a1 = C.annualDates(dt.candidates[1], 2026, hyd).dates.map(function (x) { return x.date; });
ok("annual 2026: Amāvāsyā case 10 Oct, Pratipadā case 11 Oct", a0.join() === "2026-10-10" && a1.join() === "2026-10-11", a0 + " / " + a1);
ok("Pitṛ Pakṣa 2026: Amāvāsyā case 10 Oct, Pratipadā case 27 Sep", C.mahalayaFor(dt.candidates[0], 2026, hyd).date === "2026-10-10" && C.mahalayaFor(dt.candidates[1], 2026, hyd).date === "2026-09-27");
var o96 = C.occasions96(2026, hyd);
ok("96 occasions: 12 saṅkrāntis, 12 or 13 amāvāsyās, the uncomputed families named", o96.sankranti.length === 12 && o96.amavasya.length >= 12 && o96.notEstablished.manvadi === 14);

section("5. The kuṇḍalī");
var b = { Y: 1990, M: 1, D: 1, hours: 10.5, place: hyd }, ch = K.chart(b);
var ref = { Sun: 256.796, Moon: 305.627, Mars: 226.074, Mercury: 272.03, Jupiter: 71.467, Venus: 282.537, Saturn: 261.902, Rahu: 293.142, Asc: 316.377 };
Object.keys(ref).forEach(function (g) { ok(g + " matches the oracle to 0.01°", Math.abs(ch.pos[g].lon - ref[g]) < 0.01, ch.pos[g].lon.toFixed(3)); });
ok("Mercury, Jupiter and Venus retrograde", ch.pos.Mercury.retro && ch.pos.Jupiter.retro && ch.pos.Venus.retro && !ch.pos.Sun.retro);
var V = K.vimshottari(ch), tot = V.mahadasha.reduce(function (s, n) { return s + (n.end - n.start); }, 0) / V.yearDays;
ok("nine mahādaśās make 120 years", Math.abs(tot - 120) < 1e-9, tot);
var md = V.mahadasha[2], kids = V.children(md), ksum = kids.reduce(function (s, n) { return s + (n.end - n.start); }, 0);
ok("antardaśās tile their mahādaśā", Math.abs(ksum - (md.end - md.start)) < 1e-6 && kids[0].lord === md.lord);
ok("five levels deep at any date", V.at(E.jdFromCivil(2026, 9, 28, 0)).length === 5);
var ds = K.doshas(ch), mg = ds.filter(function (x) { return x.id === "mangal"; })[0];
ok("Maṅgala from lagna, Moon and Venus, houses reported", mg.detail.length === 3 && mg.detail[0].house === 10);
ok("D9 signs from Chakra's own varga code", K.varga(ch, 9).ascSign >= 0 && K.varga(ch, 60).signs.Moon >= 0);

section("6. Matching: the defects Chakra v1 carried, now tested");
var k1 = M.kootas(29, 31);
ok("Moon sign from longitude: 29° and 31° are both Kṛttikā yet Meṣa and Vṛṣabha", k1.boy.nakshatra === 2 && k1.girl.nakshatra === 2 && k1.boy.sign === 0 && k1.girl.sign === 1);
var k2 = M.kootas(35, 148);
ok("Maitrī by sign lords: Venus and the Sun are enemies, so 0", k2.rows.filter(function (r) { return r.koota === "maitri"; })[0].score === 0, k2.rows[4].why);
[[0, 30, true], [0, 330, true], [0, 120, true], [0, 240, true], [0, 150, true], [0, 210, true], [0, 90, false], [0, 180, false], [0, 0, false]].forEach(function (x) {
  var kk = M.kootas(x[0] + 5, x[1] + 5); ok("Bhakoot " + (Math.round(x[1] / 30) + 1) + " from Meṣa is " + (x[2] ? "a doṣa" : "clear"), kk.doshas.bhakoot === x[2]);
});
ok("rows sum to the total, total at most 36", Math.abs(k2.rows.reduce(function (s, r) { return s + r.score; }, 0) - k2.total) < 1e-9 && k2.total <= 36);
var bb = { Y: 1992, M: 3, D: 14, hours: 7.25, place: hyd, uncertaintyMin: 45 }, gg = { Y: 1994, M: 11, D: 2, hours: 19.5, place: place("Kolkata"), uncertaintyMin: 90 };
var mc1 = M.monteCarlo(bb, gg, { samples: 400, seed: 7 }), mc2 = M.monteCarlo(bb, gg, { samples: 400, seed: 7 });
ok("Monte Carlo is reproducible under a seed", mc1.mean === mc2.mean && mc1.pNadi === mc2.pNadi);
var z = M.monteCarlo({ Y: 1992, M: 3, D: 14, hours: 7.25, place: hyd, uncertaintyMin: 0 }, { Y: 1994, M: 11, D: 2, hours: 19.5, place: place("Kolkata"), uncertaintyMin: 0 }, { samples: 50, seed: 1 });
ok("zero uncertainty gives zero spread at the nominal score", z.sd === 0 && z.mean === z.nominal.total);
ok("variance shares sum to one", Math.abs(mc1.share.boy + mc1.share.girl - 1) < 1e-9 || (mc1.share.boy === 0 && mc1.share.girl === 0));

section("7. Muhūrta, countdowns, calendars, music");
var mu = J.muhurta.find("shubh-general", [2026, 10, 12], 10, place("Ujjain"));
ok("windows found for a general beginning in ten days", mu.windows.length > 0, mu.windows.length);
ok("no window touches Rāhu Kāla", mu.windows.every(function (w) {
  var dd = w.date.split("-").map(Number), f = P.frame(dd[0], dd[1], dd[2], place("Ujjain")), s = P.segments(f).rahu; return w.end <= s.start || w.start >= s.end;
}));
ok("every rejection is counted by its rule", mu.rejectedHours.length > 0 && mu.rejectedHours.every(function (r) { return r.hours > 0; }));
var now = E.jdFromCivil(2026, 9, 28, 3);
["sunrise", "sunset", "tithi-end", "nakshatra-end", "purnima", "amavasya", "ekadashi", "sankranti", "rahu-kaal", "abhijit", "moonrise"].forEach(function (k) {
  var n = J.events.next(k, now, hyd); ok("next " + k + " is in the future", n && n.at > now, n && ist(n.at).d);
});
var fx = J.events.next("festival", now, hyd, "diwali-lakshmi-puja"); ok("countdown to Dīpāvalī 2026 lands on 8 Nov", fx && fx.date === "2026-11-08");
var ics = J.events.ics([{ start: now, summary: "A very long summary, with commas; and semicolons, to test folding across the seventy-five octet line limit" }], "Test", now);
ok("iCalendar: one VEVENT, CRLF lines, folded under 76 octets", /BEGIN:VEVENT[\s\S]*END:VEVENT/.test(ics) && ics.split("\r\n").every(function (l) { return Buffer.byteLength(l) <= 75; }));
var fr = P.frame(2026, 9, 28, hyd), pr = J.music.prahar(fr.sunrise + 0.01, fr);
ok("first prahar at sunrise plays a dawn rāga", pr === 0 && J.music.ragaFor(pr).id === "bhairav");
var vo = J.music.voices(E.grahas(now), J.music.ragaFor(4));
ok("nine voices at finite pitches", vo.length === 9 && vo.every(function (v) { return v.hz > 20 && v.hz < 4000; }));

section("8. Configuration and contract");
var refs = {}; bundle.references.entries.forEach(function (e) { refs[e.id] = e; });
var used = []; (function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") Object.keys(x).forEach(function (k) { if (k === "refs" && Array.isArray(x[k])) used = used.concat(x[k]); else walk(x[k]); }); })(bundle);
(function () { bundle.festivals.rules.forEach(function (r) { (r.anchors || []).forEach(function (a) { used.push(a.source.split(" ")[0]); }); }); })();
var missing = used.filter(function (id) { return !refs[id]; });
ok("every reference named in configuration exists", missing.length === 0, missing.join(","));
ok("URLs appear only on retrieved or software references", bundle.references.entries.every(function (e) { return !e.url || e.status || e.kind === "software"; }));
var labels = bundle.ai.providers.map(function (p) { return p.label.toLowerCase(); });
ok("AI providers are alphabetical", labels.join("|") === labels.slice().sort().join("|"));
ok("a keyless, local provider is offered", bundle.ai.providers.some(function (p) { return p.mode === "local"; }));
var code = fs.readdirSync(path.join(ROOT, "lib")).filter(function (f) { return f.endsWith(".js"); }).map(function (f) { return "lib/" + f; })
  .concat(fs.readdirSync(path.join(ROOT, "app")).filter(function (f) { return f.endsWith(".js"); }).map(function (f) { return "app/" + f; }))
  .concat(["sw.js", "index.html", "lib/data/jyotish-series.js"]).filter(function (f) { return fs.existsSync(path.join(ROOT, f)); });
/* vendor forms only: the zodiac sign Gemini is not a vendor, and Chakra's guard once fired on it */
var vendorWords = /claude\.ai|chatgpt|openai|perplexity\.ai|gemini\.google|grok\.com|mistral\.ai|copilot\.microsoft|ollama|anthropic/i;
var hits = code.filter(function (f) { return vendorWords.test(fs.readFileSync(path.join(ROOT, f), "utf8")); });
ok("no vendor name in code (" + code.length + " files)", hits.length === 0, hits.join(","));
var man = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor/MANIFEST.json"), "utf8"));
Object.keys(man.files).forEach(function (f) {
  var h = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "vendor", f))).digest("hex");
  ok("vendor/" + f + " is Chakra's file unchanged", h === man.files[f].sha256);
});
var bjs = fs.readFileSync(path.join(ROOT, "config/bundle.js"), "utf8"), sb = {};
new Function("self", bjs)(sb);
function canon(x) { if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]"; if (x && typeof x === "object") return "{" + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(x[k]); }).join(",") + "}"; return JSON.stringify(x); }
ok("config/bundle.js equals the JSON files", canon(sb.JyotishConfig) === canon(bundle));
var dd = bundle.dedication; ok("the dedication is configuration", dd.name && dd.passed.date === "2003-09-26");
var bio = path.join(ROOT, dd.biography); ok("the biography renders only if its file exists", !fs.existsSync(bio) || fs.readFileSync(bio, "utf8").trim().length > 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
