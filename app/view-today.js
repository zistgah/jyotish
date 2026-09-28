/*!
 * Today. The dial is the sky: sunrise on the left horizon, sunset on the right,
 * daylight above and night below, each half cut in the equal temporal parts the
 * tradition itself uses. The red hand is now.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (A) {
  "use strict";
  var h = A.h, s = A.s, J = A.J, E = J.ephem, P = J.panchang, C = J.calendar, CFG = A.CFG, PC = CFG.panchang, X = A.X, st = A.state;

  function angle(t, d) {
    if (t <= d.sunset) return Math.PI * (1 - (t - d.sunrise) / (d.sunset - d.sunrise));
    return -Math.PI * (t - d.sunset) / (d.nextSunrise - d.sunset);
  }
  function pt(cx, cy, r, a) { return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
  function arc(cx, cy, r0, r1, a0, a1) {           /* a0 > a1: clockwise sweep in screen terms */
    var p0 = pt(cx, cy, r1, a0), p1 = pt(cx, cy, r1, a1), p2 = pt(cx, cy, r0, a1), p3 = pt(cx, cy, r0, a0), large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
    return "M" + p0 + "A" + r1 + "," + r1 + " 0 " + large + " 1 " + p1 + "L" + p2 + "A" + r0 + "," + r0 + " 0 " + large + " 0 " + p3 + "Z";
  }
  var QCOL = { good: "var(--good)", neutral: "var(--mid)", bad: "var(--bad)" };
  function dial(d, now) {
    var W = 440, cx = 220, cy = 220, svg = s("svg", { viewBox: "0 0 440 440", class: "dial", role: "img", "aria-label": "Dial of the day from sunrise to sunrise" });
    var clamp = function (t) { return Math.max(d.sunrise, Math.min(d.nextSunrise, t)); };
    var ring = function (w, r0, r1, fill, op, x) {
      var a0 = angle(clamp(w.start), d), a1 = angle(clamp(w.end), d); if (a0 - a1 < 1e-4) return;
      var p = s("path", { d: arc(cx, cy, r0, r1, a0, a1), fill: fill, "fill-opacity": op, stroke: "var(--panel)", "stroke-width": 1, "x-explain": x });
      if (w.title) p.appendChild(s("title", {}, w.title)); svg.appendChild(p);
    };
    svg.appendChild(s("circle", { cx: cx, cy: cy, r: 214, fill: "var(--panel)", stroke: "var(--rule)" }));
    d.choghadiya.day.concat(d.choghadiya.night).forEach(function (c, i) {
      ring({ start: c.start, end: c.end, title: c.name + ", " + A.span(c.start, c.end) }, 196, 212, QCOL[c.quality], 0.55, function () { return X.choghadiya(c, d, i >= 8); });
    });
    var S = d.segments, next = P.segments(P.frame.apply(null, C.addDays(d.date, 1).concat([st.place])));
    [["rahu", "Rāhu Kāla", "var(--bad)"], ["yamaganda", "Yamagaṇḍa", "var(--bad)"], ["gulika", "Gulika", "var(--haldi)"], ["abhijit", "Abhijit", "var(--good)"]].forEach(function (k) {
      var w = S[k[0]]; ring({ start: w.start, end: w.end, title: k[1] + ", " + A.span(w.start, w.end) }, 182, 192, k[2], 0.9, function () { return X.segment(k[1], w, d, kalamHow(k[0], d)); });
    });
    if (next) ring({ start: next.brahma.start, end: next.brahma.end, title: "Brahma muhūrta, " + A.span(next.brahma.start, next.brahma.end) }, 182, 192, "var(--neel)", 0.9,
      function () { return X.segment("Brahma muhūrta", next.brahma, d, "The fourteenth of fifteen night muhūrtas, ending one muhūrta before sunrise."); });
    d.lagna.forEach(function (l, i) {
      ring({ start: l.start, end: l.end, title: l.name + " rising, " + A.span(l.start, l.end) }, 148, 176, i % 2 ? "var(--neel)" : "var(--haldi)", 0.16, function () { return X.lagna(l); });
      var a = (angle(clamp(l.start), d) + angle(clamp(l.end), d)) / 2, p = pt(cx, cy, 162, a);
      if (angle(clamp(l.start), d) - angle(clamp(l.end), d) > 0.16) svg.appendChild(s("text", { x: p[0], y: p[1] + 4, "text-anchor": "middle", "font-size": 11 }, l.name.slice(0, 4)));
    });
    d.limbs.tithi.forEach(function (t, i) {
      ring({ start: t.start, end: t.end, title: t.paksha + " " + t.name }, 116, 138, "var(--kumkum)", i % 2 ? 0.1 : 0.22, function () { return X.tithi(t, Math.max(t.start, d.sunrise)); });
    });
    d.limbs.nakshatra.forEach(function (n, i) {
      ring({ start: n.start, end: n.end, title: n.name }, 100, 112, "var(--neel)", i % 2 ? 0.12 : 0.3, function () { return X.nakshatra(n, Math.max(n.start, d.sunrise)); });
    });
    svg.appendChild(s("line", { x1: 8, y1: cy, x2: 432, y2: cy, stroke: "var(--ink-2)", "stroke-width": 1, "stroke-dasharray": "2 3" }));
    svg.appendChild(s("text", { x: 14, y: cy - 6, "font-size": 12 }, "East " + A.fmtT(d.sunrise)));
    svg.appendChild(s("text", { x: 426, y: cy - 6, "font-size": 12, "text-anchor": "end" }, A.fmtT(d.sunset) + " West"));
    var at = now >= d.sunrise && now < d.nextSunrise ? now : d.sunrise, L = P.limbsAt(at), el = L.elongation * Math.PI / 180;
    svg.appendChild(s("circle", { cx: cx, cy: cy, r: 88, fill: "var(--paper)", stroke: "var(--rule)" }));
    var k = Math.cos(el), rx = Math.abs(k) * 26, lit = L.elongation < 180;
    var mp = "M" + cx + "," + (cy - 58) + "A26,26 0 0 " + (lit ? 1 : 0) + " " + cx + "," + (cy - 6) + "A" + rx + ",26 0 0 " + ((k > 0) === lit ? 0 : 1) + " " + cx + "," + (cy - 58) + "Z";
    svg.appendChild(s("circle", { cx: cx, cy: cy - 32, r: 26, fill: "var(--rule)" }));
    svg.appendChild(s("path", { d: mp, fill: "var(--haldi)", "fill-opacity": 0.85 }));
    svg.appendChild(s("text", { x: cx, y: cy + 20, "text-anchor": "middle", "font-size": 17, class: "centre-name" }, L.tithi.name));
    svg.appendChild(s("text", { x: cx, y: cy + 38, "text-anchor": "middle", "font-size": 12 }, L.tithi.pakshaName + " pakṣa"));
    svg.appendChild(s("text", { x: cx, y: cy + 56, "text-anchor": "middle", "font-size": 12 }, L.nakshatra.name));
    if (now >= d.sunrise && now < d.nextSunrise) {
      var hand = s("line", { x1: cx, y1: cy, x2: 0, y2: 0, stroke: "var(--kumkum)", "stroke-width": 2.5, "stroke-linecap": "round" }), tip = s("circle", { r: 5, fill: "var(--kumkum)" });
      var place = function () { var a = angle(A.jdNow(), d), p0 = pt(cx, cy, 90, a), p = pt(cx, cy, 214, a); hand.setAttribute("x1", p0[0]); hand.setAttribute("y1", p0[1]); hand.setAttribute("x2", p[0]); hand.setAttribute("y2", p[1]); tip.setAttribute("cx", p[0]); tip.setAttribute("cy", p[1]); };
      place(); svg.appendChild(hand); svg.appendChild(tip); A.onTick(place);
    }
    return svg;
  }
  function kalamHow(k, d) {
    var map = { rahu: "Rāhu Kāla", yamaganda: "Yamagaṇḍa", gulika: "Gulika" };
    if (map[k]) return "Daylight is cut into eight equal parts; on " + d.vara.name + " " + map[k] + " is part " + PC.kalam[k][d.vara.index] + ".";
    if (k === "abhijit") return "The eighth of fifteen daylight muhūrtas, centred on local noon." + (d.segments.abhijit.excluded ? " It is not used on Wednesday." : "");
    return "";
  }
  function row(label, value, x) { return h("tr", null, h("th", { scope: "row" }, label), h("td", null, value)); }
  function limbCell(list, nameOf, xf, d) {
    return list.map(function (sp, i) {
      return h("div", null, h("span", { class: "name", x: function () { return xf(sp, Math.max(sp.start, d.sunrise)); } }, nameOf(sp)), h("span", { class: "until" }, i === 0 && sp.start < d.sunrise ? "until " + A.fmtT(sp.end) : "from " + A.fmtT(sp.start) + (sp.end < d.nextSunrise ? " until " + A.fmtT(sp.end) : "")));
    });
  }
  function table(d, full, fests) {
    var S = d.segments, tb = h("table", { class: "limbs" }), body = h("tbody");
    tb.appendChild(body);
    body.appendChild(row("Vāra", h("span", { class: "name", x: function () { return X.vara(d); } }, d.vara.name)));
    body.appendChild(row("Tithi", limbCell(d.limbs.tithi, function (t) { return t.paksha + " " + t.name + (t.kshaya ? " (kṣaya)" : ""); }, X.tithi, d)));
    body.appendChild(row("Nakṣatra", limbCell(d.limbs.nakshatra, function (n) { return n.name; }, X.nakshatra, d)));
    if (full) {
      body.appendChild(row("Yoga", limbCell(d.limbs.yoga, function (y) { return y.name; }, X.yoga, d)));
      body.appendChild(row("Karaṇa", limbCell(d.limbs.karana, function (k) { return k.name; }, X.karana, d)));
    }
    body.appendChild(row("Month", h("span", { class: "name", x: function () { return X.masa(d); } }, d.masa.shown + ", " + d.masa.paksha + " pakṣa")));
    if (full) body.appendChild(row("Year", h("span", { x: function () { return X.samvat(d); } }, "Vikrama " + d.samvat.vikram + ", Śaka " + d.samvat.shaka + ", " + d.samvat.samvatsara)));
    body.appendChild(row("Sun", [h("span", { x: function () { return X.sun(d, "rise"); } }, "rises " + A.fmtT(d.sunrise)), ", ", h("span", { x: function () { return X.sun(d, "set"); } }, "sets " + A.fmtT(d.sunset))]));
    body.appendChild(row("Moon", [h("span", { x: function () { return X.moon(d.moonrise, "Moonrise"); } }, "rises " + A.fmtT(d.moonrise)), ", ", h("span", { x: function () { return X.moon(d.moonset, "Moonset"); } }, "sets " + A.fmtT(d.moonset))]));
    if (full) body.appendChild(row("Ṛtu, ayana", d.ritu.name + ", " + (d.ayana.uttarayana ? "Uttarāyaṇa" : "Dakṣiṇāyana") + " (" + d.ritu.system + ")"));
    var seg = function (label, w, how) { return h("span", { x: function () { return X.segment(label, w, d, how); } }, A.span(w.start, w.end)); };
    body.appendChild(row("Rāhu Kāla", seg("Rāhu Kāla", S.rahu, kalamHow("rahu", d))));
    if (full) { body.appendChild(row("Yamagaṇḍa", seg("Yamagaṇḍa", S.yamaganda, kalamHow("yamaganda", d)))); body.appendChild(row("Gulika", seg("Gulika", S.gulika, kalamHow("gulika", d)))); }
    body.appendChild(row("Abhijit", S.abhijit.excluded ? "not used on Wednesday" : seg("Abhijit", S.abhijit, kalamHow("abhijit", d))));
    if (full) {
      body.appendChild(row("Brahma muhūrta", seg("Brahma muhūrta", S.brahma, "The fourteenth of fifteen night muhūrtas before this sunrise.")));
      body.appendChild(row("Pradoṣa", seg("Pradoṣa", S.pradosha, "The first fifth of the night.")));
      body.appendChild(row("Niśītha", seg("Niśītha", S.nishitha, "The eighth of fifteen night muhūrtas.")));
    }
    var F = d.flags, flags = [];
    F.panchaka.forEach(function (w) { flags.push("Pañcaka " + A.span(w.start, w.end)); });
    F.gandaMoola.forEach(function (w) { flags.push("Gaṇḍa Mūla (" + w.label + ") " + A.span(w.start, w.end)); });
    F.bhadra.forEach(function (w) { flags.push("Bhadrā " + A.span(w.start, w.end) + ", in " + w.vasa); });
    if (flags.length) body.appendChild(row("Take care", h("span", { class: "flag" }, flags.join("; "))));
    if (fests.length) body.appendChild(row("Observed", fests.map(function (f, i) { return [i ? ", " : "", h("span", { class: "festive", x: function () { return X.festival(f); } }, f.name)]; })));
    return tb;
  }
  function band(list, d0, d1, label, x) {
    var now = A.jdNow(), b = h("div", { class: "band", role: "img", "aria-label": label });
    list.forEach(function (c) {
      var w = (c.end - c.start) / (d1 - d0) * 100, cls = (c.quality || "neutral") + (now >= c.start && now < c.end ? " now" : "");
      b.appendChild(h("span", { class: cls, style: "width:" + w + "%", title: (c.name || c.lord) + ", " + A.span(c.start, c.end), x: function () { return x(c); } }, c.name || c.lord));
    });
    return [h("h3", null, label), b, h("div", { class: "scale" }, h("span", null, A.fmtT(d0)), h("span", null, A.fmtT(d1)))];
  }
  /* ---------- countdowns ---------- */
  function cards() { return A.store("cards") || CFG.widgets.default_dashboard.slice(); }
  function clocks(d) {
    var wrap = h("section", { "aria-label": "Countdowns" }), row = h("div", { class: "clocks" }), list = cards(), now = A.jdNow(), live = [];
    list.forEach(function (c, i) {
      var n = null; try { n = J.events.next(c.kind, now, st.place, c.arg); } catch (e) { n = null; }
      var el = h("div", { class: "clock" }), lf = h("div", { class: "left" }, n ? A.left((n.at - now) * 86400) : "none ahead");
      el.appendChild(lf); el.appendChild(h("div", { class: "what" }, n ? n.label : CFG.widgets.kinds[c.kind]));
      el.appendChild(h("div", { class: "when" }, n ? A.fmtDT(n.at) : "", h("button", { title: "Remove this countdown", "aria-label": "Remove", on: { click: function () { var l = cards(); l.splice(i, 1); A.store("cards", l); A.render(); } } }, "Remove")));
      row.appendChild(el); if (n) live.push({ el: lf, at: n.at, c: c });
    });
    A.onTick(function () {
      var t = A.jdNow(), stale = false;
      live.forEach(function (x) { var sec = (x.at - t) * 86400; x.el.textContent = A.left(sec); if (sec < -1) stale = true; });
      if (stale && A.state.tab === "today") A.render();
    });
    var kind = h("select", { "aria-label": "Countdown kind" }, Object.keys(CFG.widgets.kinds).map(function (k) { return h("option", { value: k }, CFG.widgets.kinds[k]); }));
    var fsel = h("select", { "aria-label": "Festival", class: "hidden" }, CFG.festivals.rules.filter(function (r) { return r.masa !== "*"; }).map(function (r) { return h("option", { value: r.id }, r.name); }));
    var dt = h("input", { type: "datetime-local", class: "hidden", "aria-label": "Date and time" }), lab = h("input", { type: "text", placeholder: "Label", class: "hidden", "aria-label": "Label" });
    kind.addEventListener("change", function () { fsel.classList.toggle("hidden", kind.value !== "festival"); dt.classList.toggle("hidden", kind.value !== "custom"); lab.classList.toggle("hidden", kind.value !== "custom"); });
    var addBtn = h("button", { on: { click: function () {
      var l = cards(), c = { kind: kind.value };
      if (c.kind === "festival") c.arg = fsel.value;
      if (c.kind === "custom") { var v = dt.value.split("T"), dd = A.parseDate(v[0]), tt = A.parseTime(v[1]); if (!dd || tt === null) { A.toast("Choose a date and time first"); return; } c.arg = { at: E.jdFromCivil(dd[0], dd[1], dd[2], tt) - st.place.tz / 24, label: lab.value || "My moment" }; }
      l.push(c); A.store("cards", l); A.render();
    } } }, "Add countdown");
    wrap.appendChild(row);
    wrap.appendChild(h("div", { class: "form" }, kind, fsel, dt, lab, addBtn, h("button", { on: { click: function () { A.store("cards", CFG.widgets.default_dashboard); A.render(); } } }, "Reset countdowns")));
    return wrap;
  }
  A.VIEWS.today = function (main) {
    var d = P.day(st.date[0], st.date[1], st.date[2], st.place), full = st.view === "full";
    if (d.polar) { main.appendChild(h("p", { class: "lede" }, d.note)); return; }
    var fests = C.festivals(st.date[0], st.place).filter(function (f) { return f.date === C.key(st.date); });
    main.appendChild(h("h2", null, A.fmtD(st.date) + ", " + st.place.name));
    main.appendChild(h("div", { class: "today" }, dial(d, A.jdNow()), table(d, full, fests)));
    main.appendChild(h("h2", null, "Counting down"));
    main.appendChild(clocks(d));
    if (full) {
      main.appendChild(h("div", null, band(d.choghadiya.day, d.sunrise, d.sunset, "Choghaḍiyā by day", function (c) { return X.choghadiya(c, d, false); }),
        band(d.choghadiya.night, d.sunset, d.nextSunrise, "Choghaḍiyā by night", function (c) { return X.choghadiya(c, d, true); }),
        band(d.hora.map(function (x) { return { start: x.start, end: x.end, name: x.lord.slice(0, 2), lord: x.lord }; }), d.sunrise, d.nextSunrise, "Horā", function (c) {
          return { title: "Horā of " + c.lord, result: A.span(c.start, c.end), steps: ["Daylight and night are each cut into twelve horās.", "The first horā after sunrise belongs to the weekday lord; the rest follow the order Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars."], basis: { status: "convention", refs: ["drik-app"] } };
        })));
      main.appendChild(h("h3", null, "Lagna through the day"));
      main.appendChild(h("div", { class: "wrap" }, h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Sign"), h("th", null, "Kind"), h("th", null, "Rises"))),
        h("tbody", null, d.lagna.map(function (l) { return h("tr", null, h("td", { x: function () { return X.lagna(l); } }, l.name), h("td", null, l.quality), h("td", null, A.span(l.start, l.end))); })))));
      main.appendChild(h("p", { class: "note" }, "Reckoning: " + d.schools.ayanamsha + "; horizon " + d.schools.horizon + "°; months " + d.schools.month + "; node " + d.schools.node + ". Change these on the Sources page."));
    }
  };
})(window.JyotishApp);
