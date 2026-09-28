/*!
 * The other rooms: calendar, festivals, Śrāddha, kuṇḍalī, matching, muhūrta, music, sources.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (A) {
  "use strict";
  var h = A.h, s = A.s, J = A.J, E = J.ephem, P = J.panchang, C = J.calendar, K = J.kundali, CFG = A.CFG, PC = CFG.panchang, X = A.X, st = A.state;
  var ABBR = CFG.kundali.abbrev;

  function fmtIn(jd, tz) { var l = A.local(jd, tz); return l.Y + "-" + A.two(l.M) + "-" + A.two(l.D) + " " + A.two(Math.floor(l.s / 3600)) + ":" + A.two(Math.floor(l.s % 3600 / 60)); }
  function field(label, el) { return h("label", null, label, el); }
  function dateInput(v) { return h("input", { type: "date", value: v || "" }); }
  function timeInput(v) { return h("input", { type: "time", step: 60, value: v || "" }); }
  function num(v, min, max, step) { return h("input", { type: "number", value: v, min: min, max: max, step: step || 1, style: "width:7em" }); }
  function pin(card) { var l = A.store("cards") || CFG.widgets.default_dashboard.slice(); l.push(card); A.store("cards", l); A.toast("Countdown added to Today"); }
  function later(el, fn) { el.innerHTML = ""; el.appendChild(h("p", { class: "note", role: "status" }, "Computing...")); setTimeout(function () { el.innerHTML = ""; try { fn(el); } catch (e) { el.appendChild(h("p", { class: "note" }, "This could not be computed: " + e.message)); if (window.console) console.error(e); } }, 30); }
  function table(head, rows) {
    return h("div", { class: "wrap" }, h("table", { class: "grid" }, h("thead", null, h("tr", null, head.map(function (x) { return h("th", null, x); }))), h("tbody", null, rows)));
  }

  /* ---------------- calendar ---------------- */
  A.VIEWS.calendar = function (main) {
    var Y = st.date[0], M = st.date[1], first = E.jdFromCivil(Y, M, 1, 12), w0 = ((Math.floor(first + 1.5) % 7) + 7) % 7;
    var go = function (dm) { var m = M + dm, y = Y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } st.date = [y, m, 1]; A.render(); };
    var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    main.appendChild(h("h2", null, MONTHS[M - 1] + " " + Y + ", " + st.place.name));
    main.appendChild(h("div", { class: "form" }, h("button", { on: { click: function () { go(-1); } } }, "Previous month"), h("button", { on: { click: function () { go(1); } } }, "Next month")));
    var fests = {};
    [Y - 1, Y, Y + 1].forEach(function (y) { if (y === Y || (y === Y - 1 && M === 1) || (y === Y + 1 && M === 12)) C.festivals(y, st.place).forEach(function (f) { (fests[f.date] = fests[f.date] || []).push(f); }); });
    var grid = h("div", { class: "month", role: "grid" });
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) { grid.appendChild(h("div", { class: "dow", role: "columnheader" }, d)); });
    var todayKey = C.key((function () { var c = E.civilFromJd(A.jdNow() + st.place.tz / 24); return [c.Y, c.M, c.D]; })());
    var dim = Math.round(E.jdFromCivil(M === 12 ? Y + 1 : Y, M === 12 ? 1 : M + 1, 1, 12) - first), cells = Math.ceil((w0 + dim) / 7) * 7;
    for (var i = 0; i < cells; i++) {
      var d = C.addDays([Y, M, 1], i - w0), k = C.key(d), f = P.frame(d[0], d[1], d[2], st.place), cell;
      var L = f.polar ? null : P.limbsAt(f.sunrise), fs = (fests[k] || []).filter(function (x) { return st.view === "full" || x.rule.masa !== "*" || /purnima|amavasya|ekadashi/.test(x.rule.id); });
      cell = h("button", { class: "cell" + (d[1] !== M ? " out" : "") + (k === todayKey ? " today" : ""), "aria-label": A.fmtD(d),
        on: { click: (function (dd) { return function () { st.date = dd; st.tab = "today"; A.render(); }; })(d) } },
        h("span", { class: "d" }, d[2]), L ? h("span", { class: "t" }, L.tithi.pakshaName.slice(0, 2) + " " + L.tithi.name) : null,
        L ? h("span", { class: "t" }, L.nakshatra.name) : null, fs.slice(0, 3).map(function (x) { return h("span", { class: "f" }, x.name); }));
      grid.appendChild(cell);
    }
    main.appendChild(grid);
    main.appendChild(h("p", { class: "note" }, "Tithi and nakṣatra as they stand at sunrise. Choose a day to open its full pañcāṅga."));
  };

  /* ---------------- festivals ---------------- */
  A.VIEWS.festivals = function (main) {
    var Y = st.date[0], all = C.festivals(Y, st.place), monthly = st.view === "full";
    main.appendChild(h("h2", null, "Observances in " + Y + ", " + st.place.name));
    main.appendChild(h("p", { class: "lede" }, "Each date is computed from its rule: the month, the tithi, and the part of the day in which the tithi must hold. Tap a name for the working."));
    var box = h("input", { type: "checkbox", checked: monthly });
    var list = all.filter(function (f) { return monthly || f.rule.masa !== "*"; });
    box.addEventListener("change", function () { st.view = box.checked ? "full" : "easy"; A.render(); });
    main.appendChild(h("div", { class: "form" }, h("label", { style: "display:flex;gap:6px;align-items:center" }, box, "Show the monthly observances"),
      h("button", { on: { click: function () {
        var ev = list.map(function (f) {
          var w = f.windows && f.windows[0], a = w ? (w.at !== undefined ? w.at : w.start) : P.frame(f.ymd[0], f.ymd[1], f.ymd[2], st.place).sunrise;
          return { start: a, end: w && w.end ? w.end : a + 1 / 24, summary: f.name, description: (f.en || "") + ". " + (f.how || "") };
        });
        A.download("jyotish-" + Y + ".ics", J.events.ics(ev, "Jyotish " + Y + ", " + st.place.name, A.jdNow()), "text/calendar");
      } } }, "Download as a calendar file")));
    main.appendChild(table(["Date", "Observance", "Window", "Rule", ""], list.map(function (f) {
      var win = (f.windows || []).map(function (w) { return w.at !== undefined ? A.fmtT(w.at, false, f.ymd) : A.fmtT(w.start, false, f.ymd) + " to " + A.fmtT(w.end, false, f.ymd) + (w.afterBhadra ? " (after Bhadrā)" : ""); }).join("; ");
      return h("tr", null, h("td", null, A.fmtD(f.ymd)), h("td", null, h("span", { class: "festive", x: function () { return X.festival(f); } }, f.name), h("div", { class: "note" }, f.en || "")),
        h("td", null, win || "none"), h("td", null, f.rule.type === "sankranti" ? "saṅkrānti" : f.rule.vyapti + ", " + f.rule.prefer, " ", A.badge(f.rule.basis)),
        h("td", null, f.rule.masa !== "*" ? h("button", { on: { click: function () { pin({ kind: "festival", arg: f.rule.id }); } } }, "Count down") : null));
    })));
  };

  /* ---------------- Śrāddha ---------------- */
  A.VIEWS.shraddha = function (main) {
    var D = CFG.dedication, thisYear = E.civilFromJd(A.jdNow()).Y;
    main.appendChild(h("h2", null, "Śrāddha"));
    main.appendChild(h("p", { class: "lede" }, "From the date of passing, the tithi of death; from the tithi, the yearly date by the aparāhṇa rule and the day of the Pitṛ Pakṣa. When the hour is not recorded, every tithi of that civil day is shown."));
    var dIn = dateInput(), tIn = timeInput(), unk = h("input", { type: "checkbox", checked: true }), tz = num(st.place.tz, -12, 14, 0.25), yr = num(thisYear, 1900, 2200), name = h("input", { type: "text", placeholder: "Name (optional)" });
    var out = h("div");
    var run = function () {
      var dd = A.parseDate(dIn.value); if (!dd) { A.toast("Choose the date of passing first"); return; }
      var hours = unk.checked ? null : A.parseTime(tIn.value), Y = Number(yr.value), tzd = Number(tz.value);
      if (!unk.checked && hours === null) { A.toast("Enter the time, or mark the hour as unknown"); return; }
      later(out, function (el) {
        var who = name.value || "the departed", res = C.deathTithi({ Y: dd[0], M: dd[1], D: dd[2], hours: hours, place: { lat: st.place.lat, lon: st.place.lon, tz: tzd } });
        el.appendChild(h("h3", null, "Tithi of passing"));
        if (res.note) el.appendChild(h("p", { class: "note" }, res.note));
        el.appendChild(table(["Tithi", "Month", "Held", "Yearly date in " + Y, "Pitṛ Pakṣa " + Y, ""], res.candidates.map(function (c) {
          var an = C.annualDates(c, Y, st.place), pp = C.mahalayaFor(c, Y, st.place), first = an.dates[0];
          return h("tr", null, h("td", null, c.paksha + " " + c.tithi), h("td", null, c.amanta + " (amānta), " + c.purnimanta + " (pūrṇimānta)" + (c.adhika ? ", adhika" : "")),
            h("td", null, c.instant ? "at " + fmtIn(c.instant, tzd) : fmtIn(c.holdsFrom, tzd) + " to " + fmtIn(c.holdsTo, tzd)),
            h("td", null, an.dates.length ? an.dates.map(function (x) { return h("div", { x: function () { return X.shraddha("Yearly Śrāddha of " + who, x); } }, A.fmtD(x.ymd), h("div", { class: "note" }, "Kutapa " + A.span(x.windows.kutapa.start, x.windows.kutapa.end))); }) : "not in this year", an.adhikaNote ? h("div", { class: "note" }, an.adhikaNote) : null),
            h("td", null, pp ? h("span", { x: function () { return X.shraddha("Pitṛ Pakṣa Śrāddha of " + who, pp); } }, A.fmtD(pp.ymd)) : "none"),
            h("td", null, first ? h("button", { on: { click: function () { pin({ kind: "custom", arg: { at: first.windows.kutapa.start, label: "Śrāddha of " + who } }); } } }, "Count down") : null));
        })));
        var pk = C.pitruPaksha(Y, st.place);
        if (pk) {
          el.appendChild(h("h3", null, "Pitṛ Pakṣa " + Y + ", " + st.place.name));
          el.appendChild(table(["Day", "Tithi", "Kutapa", "Aparāhṇa"], pk.days.map(function (x) {
            return h("tr", null, h("td", { x: function () { return X.shraddha(x.tithi + " Śrāddha", x); } }, x.ymd ? A.fmtD(x.ymd) : "none"), h("td", null, x.paksha + " " + x.tithi),
              h("td", null, x.windows ? A.span(x.windows.kutapa.start, x.windows.kutapa.end) : ""), h("td", null, x.windows ? A.span(x.windows.aparahna.start, x.windows.aparahna.end) : ""));
          })));
          el.appendChild(h("h3", null, "Special Śrāddhas"));
          el.appendChild(table(["Śrāddha", "For", "Date", "Basis"], pk.special.map(function (x) {
            return h("tr", null, h("td", null, x.name), h("td", null, x.for), h("td", null, x.date ? h("span", { x: function () { return X.shraddha(x.name, x, x.basis); } }, A.fmtD(x.date.split("-").map(Number))) : (x.note || "not computed")), h("td", null, A.badge(x.basis)));
          })));
        }
        if (st.view === "full") {
          var o = C.occasions96(Y, st.place);
          el.appendChild(h("h3", null, "The 96 occasions in " + Y));
          el.appendChild(h("p", null, "Computed: " + o.amavasya.length + " amāvāsyās, " + o.sankranti.length + " saṅkrāntis, " + o.mahalaya.length + " days of the Mahālaya fortnight, " + o.vyatipata.length + " Vyatīpāta and " + o.vaidhriti.length + " Vaidhṛti yogas."));
          el.appendChild(h("p", { class: "note" }, "Not yet dated: " + Object.keys(o.notEstablished).map(function (k) { return k + " (" + o.notEstablished[k] + ")"; }).join(", ") + ". " + CFG.shraddha.occasions_96.note));
        }
      });
    };
    unk.addEventListener("change", function () { tIn.disabled = unk.checked; });
    tIn.disabled = true;
    main.appendChild(h("div", { class: "form" }, field("Name", name), field("Date of passing", dIn), field("Time", tIn),
      h("label", { style: "display:flex;gap:6px;align-items:center" }, unk, "Hour not recorded"), field("UTC offset at the place of passing", tz), field("For the year", yr),
      h("button", { class: "primary", on: { click: run } }, "Find the Śrāddha dates")));
    main.appendChild(h("p", { class: "note" }, "Dates are for " + st.place.name + ", where the Śrāddha is performed; change the place at the top."));
    if (D && D.name) main.appendChild(h("p", null, h("button", { on: { click: function () {
      dIn.value = D.passed.date; unk.checked = D.passed.time === null; tIn.disabled = unk.checked; if (D.passed.time) tIn.value = D.passed.time;
      tz.value = D.passed.tz; name.value = D.honorific + " " + D.name; run();
    } } }, "Use the dates of " + D.honorific + " " + D.name)));
    main.appendChild(out);
  };

  /* ---------------- kuṇḍalī ---------------- */
  var NI_POS = [[150, 70], [75, 30], [30, 75], [75, 150], [30, 225], [75, 270], [150, 230], [225, 270], [270, 225], [225, 150], [270, 75], [225, 30]];
  function labelsBySign(signs, ch) {
    var by = {}; Object.keys(signs).forEach(function (g) { (by[signs[g]] = by[signs[g]] || []).push(ABBR[g] + (ch.pos[g] && ch.pos[g].retro && g !== "Rahu" && g !== "Ketu" ? "(R)" : "")); }); return by;
  }
  function textLines(svg, x, y, lines, size) {
    lines.forEach(function (t, i) { svg.appendChild(s("text", { x: x, y: y + (i - (lines.length - 1) / 2) * (size + 2), "text-anchor": "middle", "font-size": size, "dominant-baseline": "middle" }, t)); });
  }
  function chunk(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n).join(" ")); return out; }
  function chartSvg(style, signs, ch, title) {
    var svg = s("svg", { viewBox: "0 0 300 300", class: "chart", role: "img", "aria-label": title }), by = labelsBySign(signs, ch), asc = signs.Asc;
    svg.appendChild(s("rect", { x: 1, y: 1, width: 298, height: 298 }));
    if (style === "north") {
      [[0, 0, 300, 300], [300, 0, 0, 300], [150, 0, 300, 150], [300, 150, 150, 300], [150, 300, 0, 150], [0, 150, 150, 0]].forEach(function (l) { svg.appendChild(s("line", { x1: l[0], y1: l[1], x2: l[2], y2: l[3] })); });
      for (var hh = 1; hh <= 12; hh++) {
        var sg = (asc + hh - 1) % 12, p = NI_POS[hh - 1], items = (by[sg] || []).filter(function (t) { return t.indexOf("La") !== 0; });
        svg.appendChild(s("text", { x: p[0], y: p[1] + (hh === 1 ? -44 : hh === 7 ? 44 : 0) + (hh === 4 ? 0 : 0), "text-anchor": "middle", "font-size": 10, fill: "var(--kumkum)" }, String(sg + 1)));
        textLines(svg, p[0], p[1] + (hh === 1 || hh === 7 ? 0 : 14), chunk(items, hh === 1 || hh === 4 || hh === 7 || hh === 10 ? 3 : 2), 11);
      }
    } else if (style === "south") {
      var CELL = { 11: [0, 0], 0: [1, 0], 1: [2, 0], 2: [3, 0], 3: [3, 1], 4: [3, 2], 5: [3, 3], 6: [2, 3], 7: [1, 3], 8: [0, 3], 9: [0, 2], 10: [0, 1] };
      Object.keys(CELL).forEach(function (k) {
        var c = CELL[k], x = c[0] * 75, y = c[1] * 75, sgn = Number(k);
        svg.appendChild(s("rect", { x: x, y: y, width: 75, height: 75 }));
        if (sgn === asc) svg.appendChild(s("line", { x1: x, y1: y + 18, x2: x + 18, y2: y }));
        svg.appendChild(s("text", { x: x + 72, y: y + 12, "text-anchor": "end", "font-size": 9, fill: "var(--kumkum)" }, PC.rashi[sgn].name.slice(0, 3)));
        textLines(svg, x + 37.5, y + 42, chunk(by[sgn] || [], 2), 11);
      });
    } else {
      var comp = { 0: [[100, 0], [200, 0], [200, 100], [100, 100]], 1: [[0, 0], [100, 0], [100, 100]], 2: [[0, 0], [0, 100], [100, 100]], 3: [[0, 100], [100, 100], [100, 200], [0, 200]],
        4: [[0, 200], [0, 300], [100, 200]], 5: [[0, 300], [100, 300], [100, 200]], 6: [[100, 200], [200, 200], [200, 300], [100, 300]], 7: [[200, 200], [200, 300], [300, 300]],
        8: [[200, 200], [300, 200], [300, 300]], 9: [[200, 100], [300, 100], [300, 200], [200, 200]], 10: [[300, 0], [300, 100], [200, 100]], 11: [[200, 0], [300, 0], [200, 100]] };
      Object.keys(comp).forEach(function (k) {
        var pts = comp[k], sgn = Number(k), cx = pts.reduce(function (a, p) { return a + p[0]; }, 0) / pts.length, cy = pts.reduce(function (a, p) { return a + p[1]; }, 0) / pts.length;
        svg.appendChild(s("polygon", { points: pts.map(function (p) { return p.join(","); }).join(" "), fill: sgn === asc ? "var(--kumkum)" : "none", "fill-opacity": sgn === asc ? 0.08 : null }));
        textLines(svg, cx, cy, [PC.rashi[sgn].name.slice(0, 3)].concat(chunk(by[sgn] || [], 2)), 10);
      });
    }
    svg.appendChild(s("title", {}, title));
    return svg;
  }
  function dashaTree(V, now) {
    var cur = V.at(now), onPath = function (n) { return cur.some(function (c) { return c.lord === n.lord && Math.abs(c.start - n.start) < 1e-6; }); };
    function node(n) {
      var label = h("summary", { class: onPath(n) ? "cur" : null }, V.levels[n.level] + " " + n.lord + ": " + A.fmtD(ymdOf(n.start)) + " to " + A.fmtD(ymdOf(n.end)));
      var d = h("details", { class: "dasha", open: onPath(n) && n.level < 1 ? true : null }, label);
      var filled = false;
      d.addEventListener("toggle", function () { if (d.open && !filled) { filled = true; V.children(n).forEach(function (k) { d.appendChild(k.level < V.levels.length - 1 ? node(k) : h("div", { class: onPath(k) ? "cur" : null, style: "margin-left:18px" }, V.levels[k.level] + " " + k.lord + ": " + fmtIn(k.start, st.place.tz) + " to " + fmtIn(k.end, st.place.tz))); }); } });
      if (d.open) d.dispatchEvent(new Event("toggle"));
      return d;
    }
    return h("div", null, V.mahadasha.map(node));
  }
  function ymdOf(jd) { var l = A.local(jd); return [l.Y, l.M, l.D]; }
  A.VIEWS.kundali = function (main) {
    main.appendChild(h("h2", null, "Kuṇḍalī"));
    var kplace = st.place, dIn = dateInput(), tIn = timeInput("12:00"), name = h("input", { type: "text", placeholder: "Name (optional)" });
    var style = h("select", null, Object.keys(CFG.kundali.chart_styles.options).map(function (k) { return h("option", { value: k, selected: k === CFG.kundali.chart_styles.default }, CFG.kundali.chart_styles.options[k]); }));
    var varga = h("select", null, CFG.kundali.vargas.map(function (n) { return h("option", { value: n }, "D" + n); }));
    var out = h("div"), last = null;
    var draw = function () {
      if (!last) return; var ch = last, n = Number(varga.value);
      later(out, function (el) {
        var d1 = {}; Object.keys(ch.pos).forEach(function (g) { d1[g] = ch.pos[g].sign; });
        var charts = h("div", { class: "charts" }, chartSvg(style.value, d1, ch, "Rāśi chart, D1"));
        if (n !== 1) charts.appendChild(chartSvg(style.value, K.varga(ch, n).signs, ch, "Divisional chart D" + n));
        el.appendChild(charts);
        el.appendChild(h("p", { class: "note" }, "Lagna " + ch.pos.Asc.signName + " " + A.deg(ch.pos.Asc.deg) + ", " + ch.pos.Asc.nakshatraName + " pada " + ch.pos.Asc.pada + ". Ayanāṁśa " + A.deg(ch.ayanamsha) + " (" + ch.schools.ayanamsha + "), node " + ch.schools.node + "."));
        el.appendChild(table(["Graha", "Sign", "Longitude", "Nakṣatra", "House", "Bhāva", "State"], CFG.kundali.grahas.map(function (g) {
          var p = ch.pos[g];
          return h("tr", null, h("td", null, g), h("td", null, p.signName), h("td", { x: function () {
            return { title: g + " in " + p.signName, result: A.deg(p.deg) + " of " + p.signName + ", sidereal " + A.deg(p.lon),
              steps: ["Apparent tropical longitude from the VSOP87D and ELP-2000 series with light-time, aberration and nutation, for the birth instant in UT.", "Less the ayanāṁśa " + A.deg(ch.ayanamsha) + " gives the sidereal longitude.", "House " + p.house + " counts whole signs from the lagna; bhāva " + p.bhava + " uses Śrīpati's trisected quadrants.", "Daily motion " + p.speed.toFixed(4) + "°" + (p.retro ? ", so retrograde." : ".")],
              basis: { status: "definition", refs: ["meeus-1998", "bphs"] } };
          } }, A.deg(p.lon)), h("td", null, p.nakshatraName + " " + p.pada), h("td", null, p.house), h("td", null, p.bhava),
            h("td", null, [p.dignity.state, p.retro && g !== "Rahu" && g !== "Ketu" ? "retrograde" : "", p.combust ? "combust" : ""].filter(Boolean).join(", ")));
        })));
        var V = K.vimshottari(ch, CFG.schools.dasha_year_days.default);
        el.appendChild(h("h3", null, "Vimśottarī daśā"));
        el.appendChild(h("p", { class: "note" }, "At birth " + V.balance.lord + " runs " + V.balance.years.toFixed(2) + " more years. Years of " + V.yearDays + " days. Open a period to see the next level; five levels in all."));
        el.appendChild(dashaTree(V, A.jdNow()));
        el.appendChild(h("h3", null, "Doṣas"));
        K.doshas(ch).forEach(function (d) {
          el.appendChild(h("div", { style: "margin:6px 0" }, h("strong", { x: function () {
            return { title: d.name, result: d.status, steps: d.detail.map(function (x) { return JSON.stringify(x).replace(/[{}"]/g, "").replace(/,/g, ", "); }).concat(d.cancellations.map(function (c) { return "Cancellation that holds: " + c.text; })), basis: d.basis };
          } }, d.name), ": " + d.status + " ", A.badge(d.basis), d.cancellations.length ? h("div", { class: "note" }, d.cancellations.map(function (c) { return c.text; }).join("; ")) : null));
        });
        var ss = K.saturnTransit(ch, A.jdNow(), 8);
        el.appendChild(h("h3", null, "Śani over the natal Moon"));
        el.appendChild(h("p", null, ss.now.kind ? (ss.now.kind === "sade-sati" ? "Sāḍe Sātī, " + ss.now.phase + " phase" : "Ḍhaiyā") + ", Saturn in house " + ss.now.houseFromMoon + " from the Moon." : "Neither Sāḍe Sātī nor Ḍhaiyā now; Saturn is in house " + ss.now.houseFromMoon + " from the Moon."));
        el.appendChild(h("p", { class: "note" }, ss.windows.map(function (w) { return (w.kind === "sade-sati" ? "Sāḍe Sātī " : "Ḍhaiyā ") + fmtIn(w.start, st.place.tz).slice(0, 7) + " to " + (w.end ? fmtIn(w.end, st.place.tz).slice(0, 7) : "beyond the range"); }).join("; ") + ". Boundaries to within " + ss.resolutionDays + " days."));
      });
    };
    var cast = function () {
      var dd = A.parseDate(dIn.value), hh = A.parseTime(tIn.value);
      if (!dd || hh === null) { A.toast("Enter the date and time of birth"); return; }
      last = K.chart({ Y: dd[0], M: dd[1], D: dd[2], hours: hh, place: kplace, name: name.value }); draw();
    };
    style.addEventListener("change", draw); varga.addEventListener("change", draw);
    main.appendChild(h("div", { class: "form" }, field("Name", name), field("Date of birth", dIn), field("Time", tIn),
      field("Place of birth", A.placeSelect(kplace, function (p) { kplace = p; }, "kplace")), field("Chart style", style), field("Division", varga),
      h("button", { class: "primary", on: { click: cast } }, "Cast the chart")));
    main.appendChild(out);
  };

  /* ---------------- matching ---------------- */
  function personForm(label) {
    var o = { place: st.place }, d = dateInput(), t = timeInput("12:00"), u = num(30, 0, 720), r = num(0, 0, 500);
    o.el = h("fieldset", null, h("legend", null, label), h("div", { class: "form" }, field("Date of birth", d), field("Time", t),
      field("Place", A.placeSelect(o.place, function (p) { o.place = p; }, label)), field("Time uncertain by ± minutes", u), field("Place uncertain within km", r)));
    o.read = function () { var dd = A.parseDate(d.value), hh = A.parseTime(t.value); if (!dd || hh === null) return null; return { Y: dd[0], M: dd[1], D: dd[2], hours: hh, place: o.place, uncertaintyMin: Number(u.value), placeKm: Number(r.value) }; };
    return o;
  }
  function hist(res) {
    var W = 360, H = 120, svg = s("svg", { viewBox: "0 0 " + W + " " + (H + 20), class: "hist", role: "img", "aria-label": "Distribution of the total score" }), max = 0, k;
    for (k in res.histogram) max = Math.max(max, res.histogram[k]);
    for (k in res.histogram) { var x = Number(k) / 36 * (W - 8) + 4, hgt = res.histogram[k] / max * H; svg.appendChild(s("rect", { x: x - 2, y: H - hgt, width: 4, height: hgt })); }
    [0, 9, 18, 27, 36].forEach(function (v) { svg.appendChild(s("text", { x: v / 36 * (W - 8) + 4, y: H + 14, "text-anchor": "middle" }, String(v))); });
    return svg;
  }
  A.VIEWS.match = function (main) {
    var M = CFG.matching;
    main.appendChild(h("h2", null, "Matching"));
    main.appendChild(h("p", { class: "lede" }, M.disclaimer));
    var b = personForm("Groom"), g = personForm("Bride"), out = h("div");
    var nominal = function (el, bb, gg) {
      var cb = K.chart(bb), cg = K.chart(gg), k = J.match.kootas(cb.pos.Moon.lon, cg.pos.Moon.lon);
      el.appendChild(h("h3", null, "Aṣṭakūṭa: " + k.total + " of 36, " + k.verdict));
      el.appendChild(table(["Kūṭa", "Score", "Why"], k.rows.map(function (r) {
        return h("tr", null, h("td", null, r.koota), h("td", { class: "n", x: function () { return { title: r.koota, result: r.score + " of " + r.max, steps: [r.why, "Groom's Moon " + A.deg(k.boy.lon) + " (" + PC.rashi[k.boy.sign].name + ", " + PC.nakshatra[k.boy.nakshatra].name + " " + k.boy.pada + "); bride's Moon " + A.deg(k.girl.lon) + " (" + PC.rashi[k.girl.sign].name + ", " + PC.nakshatra[k.girl.nakshatra].name + " " + k.girl.pada + ")."], basis: M[r.koota] && M[r.koota].basis }; } }, r.score + " / " + r.max), h("td", null, r.why, " ", A.badge(M[r.koota] && M[r.koota].basis)));
      })));
      if (k.cancellations.length) el.appendChild(h("p", { class: "note" }, "Cancellation conditions that hold (the score is " + (k.applied ? "" : "not ") + "changed): " + k.cancellations.map(function (c) { return c.koota + ": " + (c.text || c.id); }).join("; ") + "."));
      var mb = K.doshas(cb).filter(function (x) { return x.id === "mangal"; })[0], mg = K.doshas(cg).filter(function (x) { return x.id === "mangal"; })[0];
      el.appendChild(h("p", null, "Maṅgala doṣa: groom " + mb.status + "; bride " + mg.status + "."));
    };
    main.appendChild(h("div", { class: "pair" }, b.el, g.el));
    main.appendChild(h("div", { class: "form" }, h("button", { class: "primary", on: { click: function () {
      var bb = b.read(), gg = g.read(); if (!bb || !gg) { A.toast("Enter both births"); return; } later(out, function (el) { nominal(el, bb, gg); });
    } } }, "Match"), h("button", { on: { click: function () {
      var bb = b.read(), gg = g.read(); if (!bb || !gg) { A.toast("Enter both births"); return; }
      later(out, function (el) {
        nominal(el, bb, gg);
        var r = J.match.monteCarlo(bb, gg, {}), pc = function (x) { return (100 * x).toFixed(1) + "%"; };
        el.appendChild(h("h3", null, "Under the stated uncertainty"));
        el.appendChild(hist(r));
        el.appendChild(h("p", { x: function () { return { title: "Monte Carlo", result: "mean " + r.mean.toFixed(2) + ", spread " + r.sd.toFixed(2), steps: [r.method, r.samples + " samples, seed " + r.seed + "; the run can be repeated exactly."], basis: { status: "computation", refs: [] } }; } },
          "Mean " + r.mean.toFixed(2) + ", standard deviation " + r.sd.toFixed(2) + "; from " + r.min + " to " + r.max + "; median " + r.p50 + ". Chance of 18 or more: " + pc(r.pAtLeast18) + "."));
        el.appendChild(table(["Question", "Chance"], [["Nāḍī doṣa", r.pNadi], ["Bhakoot doṣa", r.pBhakoot], ["Gaṇa at 1 or less", r.pGana], ["Groom Maṅgalik", r.pManglikBoy], ["Bride Maṅgalik", r.pManglikGirl], ["Maṅgalik on one side only", r.pManglikMismatch]]
          .map(function (x) { return h("tr", null, h("td", null, x[0]), h("td", { class: "n" }, pc(x[1]))); })));
        el.appendChild(h("p", null, "Share of the spread caused by the groom's uncertainty " + pc(r.share.boy) + ", by the bride's " + pc(r.share.girl) + ". " + r.distinctOutcomes + " distinct Moon placements occurred."));
      });
    } } }, "Run Monte Carlo")));
    main.appendChild(out);
  };

  /* ---------------- muhūrta ---------------- */
  A.VIEWS.muhurta = function (main) {
    var MU = CFG.muhurta;
    main.appendChild(h("h2", null, "Muhūrta"));
    main.appendChild(h("p", { class: "lede" }, "Choose an occasion and a span of days. Every window shown passes the occasion's rules; the hours ruled out are counted by the rule that ruled them out."));
    var occ = h("select", null, MU.occasions.map(function (o) { return h("option", { value: o.id }, o.label); }));
    var from = dateInput(C.key(st.date)), days = num(30, 1, 90), bd = dateInput(), bt = timeInput(), out = h("div");
    main.appendChild(h("div", { class: "form" }, field("Occasion", occ), field("From", from), field("Days", days), field("Your birth date (optional)", bd), field("Time", bt),
      h("button", { class: "primary", on: { click: function () {
        var f = A.parseDate(from.value); if (!f) { A.toast("Choose a start date"); return; }
        var person = null, pd = A.parseDate(bd.value), pt = A.parseTime(bt.value);
        if (pd && pt !== null) person = { moonSid: K.chart({ Y: pd[0], M: pd[1], D: pd[2], hours: pt, place: st.place }).pos.Moon.lon };
        later(out, function (el) {
          var r = J.muhurta.find(occ.value, f, Math.min(90, Number(days.value) || 30), st.place, person), o = r.occasion;
          el.appendChild(h("p", { class: "note" }, A.badge(o.basis), " ", o.basis.note || "", " Place " + st.place.name + "."));
          if (!r.windows.length) el.appendChild(h("p", null, "No window in these days passes every rule. Widen the span, or see below which rules ruled the hours out."));
          else el.appendChild(table(["Date", "Window", "Length", "Score", "Why it qualifies", ""], r.windows.slice(0, 30).map(function (w) {
            var dd = w.date.split("-").map(Number), mins = Math.round((w.end - w.start) * 1440);
            return h("tr", null, h("td", null, A.fmtD(dd)), h("td", { x: function () { return { title: o.label, result: A.fmtD(dd) + ", " + A.fmtT(w.start, false, dd) + " to " + A.fmtT(w.end, false, dd), steps: w.why.concat(["Hard rules: tithi, nakṣatra, weekday and lagna from the occasion's lists; Rāhu Kāla, Yamagaṇḍa, Gulika and Viṣṭi avoided" + (o.avoid.length > 4 ? "; also " + o.avoid.slice(4).join(", ") : "") + "."]), basis: o.basis }; } },
              A.fmtT(w.start, false, dd) + " to " + A.fmtT(w.end, false, dd)), h("td", null, Math.floor(mins / 60) + "h " + A.two(mins % 60) + "m"), h("td", { class: "n" }, w.score), h("td", null, w.why.join("; ")),
              h("td", null, h("button", { on: { click: function () { pin({ kind: "custom", arg: { at: w.start, label: o.label } }); } } }, "Count down")));
          })));
          el.appendChild(h("p", { class: "note" }, "Hours ruled out: " + r.rejectedHours.map(function (x) { return x.rule + " " + x.hours.toFixed(1); }).join(", ") + "."));
        });
      } } }, "Find windows")));
    main.appendChild(out);
  };

  /* ---------------- music ---------------- */
  var audio = null;
  A.VIEWS.music = function (main) {
    var MS = CFG.music, now = A.jdNow(), today = C.ymd(now, st.place.tz), f = P.frame(today[0], today[1], today[2], st.place);
    if (!f.polar && now < f.sunrise) { var y = C.addDays(today, -1); f = P.frame(y[0], y[1], y[2], st.place); }
    main.appendChild(h("h2", null, "Music of the orbs"));
    if (f.polar) { main.appendChild(h("p", null, "The prahar needs a sunrise and a sunset, and this place has neither today.")); return; }
    var pr = J.music.prahar(now, f), raga = J.music.ragaFor(pr), vo = J.music.voices(E.grahas(now), raga);
    main.appendChild(h("p", { class: "lede" }, "Prahar " + (pr % 4 + 1) + " of the " + (pr < 4 ? "day" : "night") + ", so rāga " + raga.name + " (" + raga.scale.join(" ") + "). Each graha sounds the svara nearest its place in the zodiac, in just intonation over Sa at " + MS.sa_hz + " Hz."));
    main.appendChild(table(["Graha", "Svara", "Pitch"], vo.map(function (v) { return h("tr", null, h("td", null, v.graha + (v.retro ? " (retrograde)" : "")), h("td", null, v.svara), h("td", { class: "n" }, v.hz.toFixed(2) + " Hz")); })));
    var vol = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: 0.5, "aria-label": "Volume" });
    var stop = function () { if (audio) { try { audio.ctx.close(); } catch (e) { } audio = null; } };
    var play = function () {
      stop(); var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { A.toast("This browser has no Web Audio"); return; }
      var ctx = new AC(), master = ctx.createGain(); master.gain.value = Number(vol.value) * 0.4; master.connect(ctx.destination);
      vo.concat([{ hz: MS.sa_hz / 2, gain: 0.25 }, { hz: MS.sa_hz * 3 / 4, gain: 0.15 }]).forEach(function (v, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = v.hz; g.gain.value = v.gain * 0.5;
        l.frequency.value = 0.07 + i * 0.013; lg.gain.value = v.gain * 0.2; l.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(master); o.start(); l.start();
      });
      audio = { ctx: ctx, master: master };
    };
    vol.addEventListener("input", function () { if (audio) audio.master.gain.value = Number(vol.value) * 0.4; });
    main.appendChild(h("div", { class: "form" }, h("button", { class: "primary", on: { click: play } }, "Play"), h("button", { on: { click: stop } }, "Stop"), field("Volume", vol)));
    main.appendChild(h("p", { class: "note" }, A.badge(MS.basis), " ", MS.basis.note));
  };

  /* ---------------- sources ---------------- */
  A.VIEWS.sources = function (main) {
    var D = CFG.dedication, S = CFG.schools, bio = h("div");
    main.appendChild(h("h2", null, "Dedication"));
    main.appendChild(h("p", { class: "dedication" }, "Dedicated to " + D.honorific + " " + D.name + ", " + D.relation + ", who passed on " + A.fmtD(D.passed.date.split("-").map(Number)) + "."));
    main.appendChild(bio);
    if (D.biography && /^https?:$/.test(location.protocol)) fetch(D.biography).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      t.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean).forEach(function (p) { bio.appendChild(h("p", { style: "max-width:68ch" }, p.replace(/^#+\s*/, ""))); });
    }).catch(function () { });
    main.appendChild(h("h2", null, "Reckoning"));
    main.appendChild(h("p", { class: "lede" }, "These choices change what is computed. Each is carried in the page address, so a shared link computes the same thing."));
    var sel = function (key, param, opts, cur) {
      var el = h("select", null, opts.map(function (o) { return h("option", { value: o[0], selected: o[0] === cur }, o[1]); }));
      el.addEventListener("change", function () { var q = new URLSearchParams(location.search); q.set(param, el.value); location.search = q.toString(); });
      return field(key, el);
    };
    var hz = Object.keys(S.horizon.options).filter(function (k) { return S.horizon.options[k].altitude_deg === P.options.horizon; })[0] || S.horizon.default;
    main.appendChild(h("div", { class: "form" },
      sel("Ayanāṁśa", "ayanamsha", Object.keys(S.ayanamsha.options).map(function (k) { return [k, S.ayanamsha.options[k].label]; }), S.ayanamsha.default),
      sel("Sunrise and sunset", "horizon", Object.keys(S.horizon.options).map(function (k) { return [k, S.horizon.options[k].label]; }), hz),
      sel("Months", "month", S.month_system.options.map(function (k) { return [k, k]; }), P.options.month),
      sel("Lunar node", "node", S.node.options.map(function (k) { return [k, k]; }), P.options.node),
      sel("Ṛtu", "ritu", S.ritu.options.map(function (k) { return [k, k]; }), P.options.ritu),
      sel("Ayana", "ayana", S.ayana.options.map(function (k) { return [k, k]; }), P.options.ayana)));
    main.appendChild(h("h2", null, "Accuracy"));
    var acc = SITE_ACC();
    main.appendChild(h("p", { class: "lede" }, acc));
    main.appendChild(h("h2", null, "Sources"));
    main.appendChild(table(["Source", "By", "Status"], CFG.references.entries.map(function (r) {
      return h("tr", null, h("td", null, r.url ? h("a", { href: r.url, rel: "noopener", target: "_blank" }, r.title) : r.title), h("td", null, r.author || r.publisher || ""), h("td", null, r.status || r.kind || ""));
    })));
    main.appendChild(h("p", { class: "note" }, CFG.references._about));
    main.appendChild(h("h2", null, "About"));
    main.appendChild(h("p", null, SITE.name + " " + J.VERSION + " on engine " + E.VERSION + ". " + SITE.projection_note + " Derived from Chakra (project-ilm/chakra), concept DOI 10.5281/zenodo.21253628. Software GPL-3.0-or-later; documents CC BY-SA 4.0. © 1993–2026 Abhishek Choudhary. All rights reserved. AyeAI."));
  };
  var SITE = CFG.jyotish;
  function SITE_ACC() {
    var a = SITE.accuracy; if (!a) return "";
    return "Measured against an independent ephemeris from 1900 to 2100: the Sun within " + a.sun_arcsec + "″, the planets within " + a.planets_arcsec + "″, the Moon within " + a.moon_arcsec + "″, sidereal positions within " + a.sidereal_arcsec + "″ of the Lahiri definition, sunrise and sunset within " + a.rise_set_s + " s, moonrise within " + a.moonrise_s + " s. The test suite re-measures these on every run.";
  }
})(window.JyotishApp);
