/*!
 * Jyotish interface. Every number on the page can be explained: tap it, or right-click,
 * or select it, and the working appears; from there any listed AI can be asked with the
 * working, the place, the date and the reckonings already in the question.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function () {
  "use strict";
  var CFG = window.JyotishConfig, J = window.Jyotish.create(CFG), E = J.ephem, P = J.panchang, C = J.calendar, K = J.kundali;
  var PC = CFG.panchang, SITE = CFG.jyotish, REFS = {};
  CFG.references.entries.forEach(function (r) { REFS[r.id] = r; });

  /* ---------- state lives in the URL, so a link carries its context ---------- */
  var q = new URLSearchParams(location.search), state = {};
  function jdNow() { return Date.now() / 86400000 + 2440587.5; }
  function placeFromParam(v) {
    if (!v) return SITE.place;
    var named = SITE.places.filter(function (p) { return p.name === v; })[0]; if (named) return named;
    var a = v.split(",").map(Number);
    return a.length >= 3 && a.every(isFinite) ? { name: a[0].toFixed(3) + ", " + a[1].toFixed(3), lat: a[0], lon: a[1], tz: a[2] } : SITE.place;
  }
  state.place = placeFromParam(q.get("place"));
  state.tab = q.get("tab") || "today";
  state.view = q.get("view") || SITE.views.default;
  (function () {
    var d = (q.get("date") || "").split("-").map(Number);
    if (d.length === 3 && d.every(isFinite)) state.date = d;
    else { var c = E.civilFromJd(jdNow() + state.place.tz / 24); state.date = [c.Y, c.M, c.D]; }
  })();
  state.schools = {};
  ["ayanamsha", "horizon", "month", "node", "ritu", "ayana"].forEach(function (k) {
    var v = q.get(k); if (!v) return;
    var ok = k === "ayanamsha" ? !!CFG.schools.ayanamsha.options[v] : k === "horizon" ? !!CFG.schools.horizon.options[v] :
      (CFG.schools[k === "month" ? "month_system" : k].options.indexOf(v) >= 0);
    if (ok) { P.setSchool(k, v); state.schools[k] = v; }
  });
  function sync() {
    var p = new URLSearchParams();
    p.set("tab", state.tab); p.set("view", state.view); p.set("date", C.key(state.date));
    p.set("place", SITE.places.some(function (x) { return x.name === state.place.name; }) ? state.place.name : [state.place.lat, state.place.lon, state.place.tz].join(","));
    Object.keys(state.schools).forEach(function (k) { p.set(k, state.schools[k]); });
    /* a page opened from file:// may not rewrite its own address in some browsers; the context
       still travels inside every explanation, so the page carries on */
    try { history.replaceState(null, "", location.pathname + "?" + p.toString()); } catch (e) { state.addressFixed = true; }
  }

  /* ---------- formatting ---------- */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function local(jd, tz) { var c = E.civilFromJd(jd + (tz === undefined ? state.place.tz : tz) / 24), s = Math.round(c.hours * 3600); if (s >= 86400) { c = E.civilFromJd(jd + 1e-5 + state.place.tz / 24); s = 0; } return { Y: c.Y, M: c.M, D: c.D, s: s }; }
  function fmtT(jd, sec, ref) {
    if (jd === null || jd === undefined || !isFinite(jd)) return "none";
    var l = local(jd), out = two(Math.floor(l.s / 3600)) + ":" + two(Math.floor(l.s % 3600 / 60)) + (sec ? ":" + two(l.s % 60) : "");
    ref = ref || state.date;
    var dd = Math.round(E.jdFromCivil(l.Y, l.M, l.D, 0) - E.jdFromCivil(ref[0], ref[1], ref[2], 0));
    return dd ? out + " (" + (dd > 0 ? "+" : "") + dd + "d)" : out;
  }
  function fmtD(d) { var w = ((Math.floor(E.jdFromCivil(d[0], d[1], d[2], 12) + 1.5) % 7) + 7) % 7; return DOW[w] + " " + d[2] + " " + MON[d[1] - 1] + " " + d[0]; }
  function fmtDT(jd) { var l = local(jd); return fmtD([l.Y, l.M, l.D]) + ", " + fmtT(jd, false, [l.Y, l.M, l.D]); }
  function span(a, b) { return fmtT(a) + " to " + fmtT(b); }
  function deg(x) { var d = Math.floor(x), m = Math.floor((x - d) * 60), s = Math.round(((x - d) * 60 - m) * 60); if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; } return d + "° " + two(m) + "′ " + two(s) + "″"; }
  function left(sec) {
    if (sec < 0) return "now";
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    return (d ? d + "d " : "") + two(h) + ":" + two(m) + ":" + two(s);
  }
  function parseDate(v) { var a = String(v).split("-").map(Number); return a.length === 3 && a.every(isFinite) ? a : null; }
  function parseTime(v) { if (!v) return null; var a = v.split(":").map(Number); return a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600; }

  /* ---------- element builder ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    if (attrs) for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (k === "class") el.className = attrs[k];
      else if (k === "x") { el.setAttribute("data-x", xid(attrs.x)); el.setAttribute("tabindex", "0"); }
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "object" && c.nodeType ? c : document.createTextNode(String(c)));
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag), k;
    for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) {
      if (k === "x-explain") el.setAttribute("data-x", xid(attrs[k])); else el.setAttribute(k, attrs[k]);
    }
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function badge(basis) { if (!basis || !basis.status) return null; return h("span", { class: "status " + basis.status, title: basis.note || "" }, basis.status); }
  function toast(msg) { var t = h("div", { class: "toast", role: "status" }, msg); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem("jyotish." + key)); localStorage.setItem("jyotish." + key, JSON.stringify(val)); } catch (e) { return null; } return null; }
  function download(name, text, type) { var a = h("a", { href: URL.createObjectURL(new Blob([text], { type: type })), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- the explainer ---------- */
  var X = {}, seq = 0;
  function xid(fn) { var id = "x" + (++seq); X[id] = fn; return id; }
  function refText(ids) { return (ids || []).map(function (id) { var r = REFS[id]; return r ? r.title + (r.author ? " (" + r.author + ")" : "") + (r.url ? " " + r.url : "") : id; }); }
  function context() {
    return "Place " + state.place.name + " (" + state.place.lat.toFixed(4) + ", " + state.place.lon.toFixed(4) + ", UTC" + (state.place.tz >= 0 ? "+" : "") + state.place.tz + "); date " + C.key(state.date) +
      "; ayanāṁśa " + P.options.ayan.label + "; horizon " + P.options.horizon + "°; months " + P.options.month + "; node " + P.options.node + ".";
  }
  function question(x) {
    return [CFG.ai.prompt_intro, "", x.title, "Result: " + x.result, "Working:"].concat(x.steps.map(function (s, i) { return (i + 1) + ". " + s; }))
      .concat(["Basis: " + ((x.basis && x.basis.status) || "computation") + (x.basis && x.basis.note ? ". " + x.basis.note : ""), "Sources: " + refText(x.basis && x.basis.refs).join("; "), "Context: " + context()]).join("\n");
  }
  var menuEl = null, panelEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } }
  function ask(provider, x) {
    var text = question(x);
    if (provider.mode === "url") { window.open(provider.url + encodeURIComponent(text.slice(0, CFG.ai.max_url_chars)), "_blank", "noopener"); return; }
    if (provider.mode === "copy") {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast(CFG.ai.copy_note); }, function () { toast("Copying failed; the question is shown in the working panel."); showPanel(x, text); });
      window.open(provider.url, "_blank", "noopener"); return;
    }
    if (provider.mode === "local") {
      showPanel(x, "Asking " + provider.label + " at " + provider.endpoint + " ...");
      fetch(provider.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: provider.model, prompt: text, stream: false }) })
        .then(function (r) { return r.json(); }).then(function (d) { showPanel(x, d.response || JSON.stringify(d)); })
        .catch(function () { showPanel(x, "No local model answered at " + provider.endpoint + ". Start one there, or choose another provider."); });
    }
  }
  function showPanel(x, extra) {
    closePanel(); closeMenu();
    panelEl = h("aside", { class: "explain", role: "dialog", "aria-label": "Working" },
      h("button", { class: "close", on: { click: closePanel }, "aria-label": "Close" }, "Close"),
      h("h3", null, x.title), h("p", null, h("strong", null, x.result)),
      h("ol", null, x.steps.map(function (st) { return h("li", null, st); })),
      x.basis ? h("p", { class: "note" }, badge(x.basis), " ", x.basis.note || "", " ", refText(x.basis.refs).length ? "Sources: " + refText(x.basis.refs).join("; ") + "." : "") : null,
      extra ? h("pre", { style: "white-space:pre-wrap;font:inherit" }, extra) : null,
      h("p", { class: "note" }, "Ask an AI about this working:"),
      h("div", { class: "form" }, CFG.ai.providers.map(function (p) { return h("button", { on: { click: function () { ask(p, x); } } }, p.label); }),
        h("button", { on: { click: function () { (navigator.clipboard ? navigator.clipboard.writeText(question(x)) : Promise.reject()).then(function () { toast("Question copied"); }, function () { toast("Copying is not allowed here"); }); } } }, "Copy the question")));
    document.body.appendChild(panelEl);
    panelEl.querySelector("button").focus();
  }
  function explainOf(el) {
    var n = el && el.closest ? el.closest("[data-x]") : null;
    if (!n) return null;
    var f = X[n.getAttribute("data-x")]; return f ? f() : null;
  }
  function selectionExplain() {
    var sel = window.getSelection(), t = sel ? String(sel).trim() : "";
    if (!t) return null;
    var base = sel.anchorNode ? explainOf(sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
    return base || { title: "The selected text", result: t.slice(0, 400), steps: ["Selected on the " + state.tab + " page."], basis: null };
  }
  function openMenu(x, px, py) {
    closeMenu();
    menuEl = h("div", { class: "menu", role: "menu" },
      h("button", { role: "menuitem", on: { click: function () { showPanel(x); } } }, "Show the working"), h("hr"),
      CFG.ai.providers.map(function (p) { return h("button", { role: "menuitem", on: { click: function () { closeMenu(); ask(p, x); } } }, "Ask " + p.label); }));
    document.body.appendChild(menuEl);
    var r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.max(4, Math.min(px, innerWidth - r.width - 4)) + "px";
    menuEl.style.top = Math.max(4, Math.min(py, innerHeight - r.height - 4)) + "px";
    menuEl.querySelector("button").focus();
  }
  document.addEventListener("contextmenu", function (e) {
    var x = selectionExplain() || explainOf(e.target);
    if (!x) return;
    e.preventDefault(); openMenu(x, e.clientX, e.clientY);
  });
  document.addEventListener("click", function (e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
    if (e.target.closest && e.target.closest("button, a, select, input, summary")) return;
    var x = explainOf(e.target); if (x) showPanel(x);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeMenu(); closePanel(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.getAttribute && e.target.getAttribute("data-x")) { e.preventDefault(); var x = explainOf(e.target); if (x) showPanel(x); }
  });

  /* ---------- shell ---------- */
  var TABS = [["today", "Today"], ["calendar", "Calendar"], ["festivals", "Festivals"], ["shraddha", "Śrāddha"], ["kundali", "Kuṇḍalī"],
    ["match", "Match"], ["muhurta", "Muhūrta"], ["music", "Music"], ["sources", "Sources"]].filter(function (t) { return SITE.features[t[0]] !== false; });
  var VIEWS = {}, mainEl, tabsEl;
  function placeSelect(cur, onchange, id) {
    var sel = h("select", { id: id, "aria-label": "Place" }, SITE.places.map(function (p) { return h("option", { value: p.name, selected: p.name === cur.name }, p.name); }),
      SITE.places.some(function (p) { return p.name === cur.name; }) ? null : h("option", { value: "__cur", selected: true }, cur.name),
      h("option", { value: "__custom" }, "Another place..."), navigator.geolocation ? h("option", { value: "__here" }, "Where I am") : null);
    sel.addEventListener("change", function () {
      var v = sel.value;
      if (v === "__custom") {
        var t = prompt("Latitude, longitude, UTC offset in hours (for example 17.385, 78.487, 5.5)", [cur.lat, cur.lon, cur.tz].join(", "));
        var a = t ? t.split(",").map(Number) : []; if (a.length === 3 && a.every(isFinite)) onchange({ name: a[0].toFixed(3) + ", " + a[1].toFixed(3), lat: a[0], lon: a[1], tz: a[2] });
        else sel.value = cur.name;
      } else if (v === "__here") {
        navigator.geolocation.getCurrentPosition(function (pos) {
          var tz = -new Date().getTimezoneOffset() / 60;
          onchange({ name: "Here (" + pos.coords.latitude.toFixed(3) + ", " + pos.coords.longitude.toFixed(3) + ")", lat: pos.coords.latitude, lon: pos.coords.longitude, tz: tz });
        }, function () { toast("Location was not shared; choose a place from the list."); sel.value = cur.name; });
      } else if (v !== "__cur") onchange(SITE.places.filter(function (p) { return p.name === v; })[0]);
    });
    return sel;
  }
  function header() {
    var dateIn = h("input", { type: "date", value: C.key(state.date), "aria-label": "Date" });
    dateIn.addEventListener("change", function () { var d = parseDate(dateIn.value); if (d) { state.date = d; render(); } });
    var todayBtn = h("button", { on: { click: function () { var c = E.civilFromJd(jdNow() + state.place.tz / 24); state.date = [c.Y, c.M, c.D]; render(); } } }, "Today");
    var viewSel = h("select", { "aria-label": "View" }, Object.keys(SITE.views.options).map(function (k) { return h("option", { value: k, selected: k === state.view }, SITE.views.options[k]); }));
    viewSel.addEventListener("change", function () { state.view = viewSel.value; render(); });
    var theme = store("theme"), themeSel = h("select", { "aria-label": "Theme" }, [["", "Theme follows the device"], ["light", "Paper"], ["dark", "Night"]].map(function (t) { return h("option", { value: t[0], selected: (theme || "") === t[0] }, t[1]); }));
    themeSel.addEventListener("change", function () { store("theme", themeSel.value); applyTheme(); });
    return h("header", { class: "top" },
      h("div", { class: "brand" }, h("h1", null, h("span", { class: "dev", lang: "sa" }, "ज्योतिष"), SITE.name), h("p", null, SITE.tagline)),
      h("div", { class: "controls" },
        h("label", null, "Place", placeSelect(state.place, function (p) { state.place = p; render(); }, "place")),
        h("label", null, "Date", dateIn), todayBtn,
        h("label", null, "View", viewSel), h("label", null, "Theme", themeSel)));
  }
  function applyTheme() { var t = store("theme"); if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  function tabs() {
    tabsEl = h("nav", { class: "tabs", role: "tablist", "aria-label": "Sections" }, TABS.map(function (t) {
      return h("button", { role: "tab", "aria-selected": t[0] === state.tab ? "true" : "false", on: { click: function () { state.tab = t[0]; render(); } } }, t[1]);
    }));
    return tabsEl;
  }
  var ticker = null, tickers = [];
  function onTick(fn) { tickers.push(fn); }
  function render() {
    closeMenu(); closePanel(); X = {}; seq = 0; tickers = [];
    var root = document.getElementById("app"); root.innerHTML = "";
    mainEl = h("main", { id: "main", tabindex: "-1" });
    root.appendChild(header()); root.appendChild(tabs()); root.appendChild(mainEl);
    try { (VIEWS[state.tab] || VIEWS.today)(mainEl); }
    catch (err) { mainEl.appendChild(h("p", { class: "note" }, "This page could not be computed: " + err.message)); if (window.console) console.error(err); }
    sync();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(function () { tickers.forEach(function (f) { f(); }); }, 1000);
  }
  window.JyotishApp = { VIEWS: VIEWS, h: h, s: s, fmtT: fmtT, fmtD: fmtD, fmtDT: fmtDT, span: span, deg: deg, left: left, badge: badge, toast: toast, store: store,
    download: download, xid: xid, state: state, render: render, onTick: onTick, jdNow: jdNow, parseDate: parseDate, parseTime: parseTime, placeSelect: placeSelect,
    local: local, refText: refText, J: J, CFG: CFG, two: two };
  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(); render();
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(function () { });
  });
})();
