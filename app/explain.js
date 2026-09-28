/*!
 * Explanations: the working behind each number, written from the engine's own values.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (A) {
  "use strict";
  var J = A.J, E = J.ephem, P = J.panchang, CFG = A.CFG, PC = CFG.panchang, deg = A.deg, T = A.fmtT;
  var SKY = "Apparent places from the VSOP87D planetary series and the ELP-2000 lunar series, with light-time, aberration and IAU 1980 nutation.";
  var X = {};
  X.tithi = function (s, at) {
    var sk = P.sky(at), n = P.tithiName(s.idx);
    return { title: "Tithi: " + n.pakshaName + " " + n.name, result: n.pakshaName + " " + n.name + ", " + A.span(s.start, s.end),
      steps: ["At " + T(at) + " the Sun is at " + deg(sk.sun) + " and the Moon at " + deg(sk.moon) + " of tropical longitude. " + SKY,
        "Elongation, Moon less Sun: " + deg(sk.elong) + ".",
        "Tithi = the elongation divided by 12°, rounded down, plus one: " + (s.idx + 1) + " of 30. Tithis 1 to 15 are the Śukla pakṣa, 16 to 30 the Kṛṣṇa pakṣa.",
        "It began when the elongation reached " + (s.idx * 12) + "° at " + T(s.start) + " and ends at " + ((s.idx + 1) * 12) + "° at " + T(s.end) + "; each instant is solved by Newton's method to below a second."],
      basis: { status: "definition", refs: ["surya-siddhanta-burgess", "meeus-1998"], note: "The tithi is astronomy: a twelve-degree step of the Moon away from the Sun." } };
  };
  X.nakshatra = function (s, at) {
    var sk = P.sky(at), nm = PC.nakshatra[s.idx];
    return { title: "Nakṣatra: " + nm.name, result: nm.name + " pada " + (Math.floor((sk.moonSid - s.idx * 360 / 27) / (90 / 27)) + 1) + ", " + A.span(s.start, s.end),
      steps: ["The Moon's tropical longitude at " + T(at) + " is " + deg(sk.moon) + ". " + SKY,
        "Less the ayanāṁśa (" + P.options.ayan.label + ", with nutation) of " + deg(sk.ayan) + ", the sidereal longitude is " + deg(sk.moonSid) + ".",
        "Each nakṣatra is 13° 20′, so this is nakṣatra " + (s.idx + 1) + " of 27; each pada is 3° 20′.",
        "Lord " + nm.lord + ", deity " + nm.deity + ", gaṇa " + PC.nakshatra_attributes.gana[nm.gana] + ", nāḍī " + PC.nakshatra_attributes.nadi[nm.nadi] + "."],
      basis: { status: "definition", refs: ["surya-siddhanta-burgess", "icrc-1955"], note: "The ayanāṁśa is a school choice; it is named in every answer." } };
  };
  X.yoga = function (s, at) {
    var sk = P.sky(at);
    return { title: "Yoga: " + PC.yoga[s.idx], result: PC.yoga[s.idx] + ", " + A.span(s.start, s.end),
      steps: ["Sidereal Sun " + deg(sk.sunSid) + " and sidereal Moon " + deg(sk.moonSid) + " at " + T(at) + ".",
        "Their sum is " + deg(E.rev(sk.sunSid + sk.moonSid)) + "; divided into 27 parts of 13° 20′ it gives yoga " + (s.idx + 1) + "."],
      basis: { status: "definition", refs: ["surya-siddhanta-burgess"] } };
  };
  X.karana = function (s) {
    return { title: "Karaṇa: " + P.karanaName(s.idx), result: P.karanaName(s.idx) + ", " + A.span(s.start, s.end),
      steps: ["A karaṇa is half a tithi: the elongation divided by 6° gives karaṇa " + (s.idx + 1) + " of 60.",
        "The first half of Śukla Pratipadā is Kiṃstughna; the last three are Śakuni, Catuṣpāda and Nāga; the seven movable karaṇas repeat in between." + (P.isVishti(s.idx) ? " This one is Viṣṭi, also called Bhadrā." : "")],
      basis: PC.karana.basis };
  };
  X.vara = function (d) {
    return { title: "Vāra: " + d.vara.name, result: d.vara.name + ", from sunrise " + T(d.sunrise) + " to the next sunrise " + T(d.nextSunrise),
      steps: ["The Hindu day runs from one sunrise to the next.", "The weekday is that of the civil date on which the day begins; its lord is " + d.vara.lord + "."],
      basis: { status: "convention", refs: ["surya-siddhanta-burgess"] } };
  };
  X.sun = function (d, which) {
    var t = which === "rise" ? d.sunrise : d.sunset;
    return { title: which === "rise" ? "Sunrise" : "Sunset", result: A.fmtT(t, true),
      steps: ["The Sun's altitude is computed from its apparent place, the sidereal time and the place's latitude and longitude.",
        "The event is the instant the altitude crosses " + P.options.horizon + "° (" + CFG.schools.horizon.default + " by default; set on the Sources page), found by bisection to under a second.",
        "Against an independent ephemeris the same definition agrees within about 4 seconds from 2000 to 2010."],
      basis: { status: "convention", refs: ["meeus-1998", "pyswisseph-oracle"], note: "Almanacs differ by a minute or two when they use a different horizon." } };
  };
  X.moon = function (t, which) {
    return { title: which, result: t ? A.fmtT(t, true) : "The Moon does not " + (which === "Moonrise" ? "rise" : "set") + " on this civil date",
      steps: ["The Moon's horizon altitude is 0.7275 times its horizontal parallax less 34′, which allows for parallax, refraction and the Moon's radius.",
        "The crossing is found by bisection between hourly samples; agreement with the independent ephemeris is within 3 seconds."],
      basis: { status: "convention", refs: ["meeus-1998", "pyswisseph-oracle"] } };
  };
  X.masa = function (d) {
    var L = d.masa.lunation;
    return { title: "Month: " + d.masa.shown, result: "Amānta " + d.masa.amanta + ", pūrṇimānta " + d.masa.purnimanta + ", " + d.masa.paksha + " pakṣa",
      steps: ["The lunation runs from the new moon of " + A.fmtDT(L.start) + " to that of " + A.fmtDT(L.end) + ".",
        "The sidereal Sun is in " + PC.rashi[L.sunSignAtStart].name + " at its start; " + L.sankrantis + " saṅkrānti" + (L.sankrantis === 1 ? "" : "s") + " fall inside it.",
        "The month is named for the sign the Sun enters: " + L.masa + (L.adhika ? ". No saṅkrānti falls inside, so it is adhika." : L.kshaya ? ". Two saṅkrāntis fall inside, so a month is kṣaya." : "."),
        "In pūrṇimānta reckoning the dark fortnight takes the next month's name."],
      basis: CFG.schools.month_system.basis };
  };
  X.samvat = function (d) {
    return { title: "Year", result: "Vikrama " + d.samvat.vikram + ", Śaka " + d.samvat.shaka + ", Kali " + d.samvat.kali + ", " + d.samvat.samvatsara,
      steps: ["The lunar year begins with the Caitra lunation, which began " + A.fmtDT(d.samvat.yearStart) + ".",
        "Vikrama = the Gregorian year of that start plus " + PC.samvat.vikram_offset + "; Śaka = Vikrama less 135; Kali = Śaka plus 3179.",
        "The samvatsara is " + PC.samvat.samvatsara_index + ": " + d.samvat.samvatsara + "."],
      basis: PC.samvat.basis };
  };
  X.segment = function (name, w, d, how) {
    return { title: name, result: A.span(w.start, w.end), steps: [how, "Daylight today: " + A.span(d.sunrise, d.sunset) + "; night: " + A.span(d.sunset, d.nextSunrise) + "."],
      basis: { status: "convention", refs: ["drik-app", "muhurta-chintamani"] } };
  };
  X.choghadiya = function (c, d, night) {
    return { title: "Choghaḍiyā: " + c.name, result: c.name + " (" + c.quality + "), " + A.span(c.start, c.end),
      steps: [(night ? "The night" : "Daylight") + " is cut into eight equal parts.", "The first part " + (night ? "of the night is ruled by the lord of the fifth weekday counted from today" : "is ruled by the weekday lord, " + d.vara.lord) + "; the rest follow the horā order.",
        "This part is ruled by " + c.lord + ", which names it " + c.name + "."], basis: PC.choghadiya.basis };
  };
  X.lagna = function (l) {
    return { title: "Lagna: " + l.name, result: l.name + " rises " + A.span(l.start, l.end),
      steps: ["The ascendant is the ecliptic degree on the eastern horizon, from the local apparent sidereal time, the true obliquity and the latitude.",
        "Less the ayanāṁśa it becomes sidereal; the instants when it crosses a sign boundary are found by bisection.", l.name + " is a " + l.quality + " sign."],
      basis: { status: "definition", refs: ["meeus-1998"] } };
  };
  X.festival = function (f) {
    var r = f.rule, st = [];
    if (r.type === "sankranti") st.push("The Sun's sidereal longitude reaches " + (r.sign * 30) + "° at " + A.fmtDT(f.instant) + ".", f.how + ".");
    else {
      st.push("Rule: " + r.masa.replace("*", "every month") + " " + r.paksha + " pakṣa, tithi " + r.tithi + ", which must hold in the " + r.vyapti + " window (" + (CFG.festivals.vyapti_windows[r.vyapti] || r.vyapti) + ").");
      st.push("The tithi runs " + A.fmtDT(f.tithiStart) + " to " + A.fmtDT(f.tithiEnd) + ".");
      st.push("Choice: " + (CFG.festivals.prefer_rules[r.prefer] || r.prefer) + ". Here " + f.how + ".");
      (f.windows || []).forEach(function (w) { st.push(w.at !== undefined ? "The instant: " + A.fmtDT(w.at) + "." : "Window: " + A.fmtDT(w.start) + " to " + A.fmtT(w.end, false, A.local(w.start) && [A.local(w.start).Y, A.local(w.start).M, A.local(w.start).D]) + (w.afterBhadra ? ", after Bhadrā ends" : w.bhadraRemoved ? ", with Bhadrā removed" : "") + "."); });
    }
    return { title: f.name, result: A.fmtD(f.ymd), steps: st, basis: r.basis };
  };
  X.shraddha = function (title, row, basis) {
    return { title: title, result: row.date ? A.fmtD(row.date.split("-").map(Number)) : "not dated",
      steps: [row.tithiStart ? "The tithi runs " + A.fmtDT(row.tithiStart) + " to " + A.fmtDT(row.tithiEnd) + "." : null,
        row.how ? "The day: " + row.how + "." : null,
        row.windows ? "Kutapa " + A.span(row.windows.kutapa.start, row.windows.kutapa.end) + "; Rauhiṇa " + A.span(row.windows.rauhina.start, row.windows.rauhina.end) + "; Aparāhṇa " + A.span(row.windows.aparahna.start, row.windows.aparahna.end) + "." : null,
        CFG.shraddha.tithi_rule.basis.note].filter(Boolean), basis: basis || CFG.shraddha.tithi_rule.basis };
  };
  A.X = X;
})(window.JyotishApp);
