#!/usr/bin/env node
/*
 * Headless run of the real page: every tab renders, every form computes, the explainer
 * opens, and no script error is raised. Needs jsdom; when it is not installed the run
 * says SKIPPED and proves nothing, which ops/verify.sh reports as such.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. AyeAI.
 */
"use strict";
var path = require("path"), JSDOM;
try { JSDOM = require("jsdom").JSDOM; } catch (e) { console.log("SKIPPED: jsdom is not installed, so the interface was not exercised"); process.exit(0); }
var ROOT = path.join(__dirname, ".."), pass = 0, fail = 0, errors = [];
function ok(name, cond, detail) { if (cond) pass++; else fail++; console.log((cond ? "  ok   " : "  FAIL ") + name + (detail !== undefined ? "  [" + detail + "]" : "")); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 20000)) { try { if (fn()) return true; } catch (e) { } await sleep(50); } return false; }

(async function () {
  var jsdom = require("jsdom"), vc = new jsdom.VirtualConsole();
  vc.on("jsdomError", function (e) { errors.push(String(e && (e.stack || e.message) || e)); });
  vc.on("error", function (e) { errors.push("console.error: " + e); });
  var url = "file://" + path.join(ROOT, "index.html") + "?tab=today&place=Hyderabad&date=2026-09-28&view=full";
  var dom = await JSDOM.fromFile(path.join(ROOT, "index.html"), { url: url, runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc });
  var w = dom.window, d = w.document;
  await until(function () { return d.querySelector("main h2"); }, 30000);
  var tab = function (name) { var b = Array.prototype.filter.call(d.querySelectorAll("nav.tabs button"), function (x) { return x.textContent === name; })[0]; b.click(); };
  var main = function () { return d.querySelector("main"); };
  var setVal = function (el, v) { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); el.dispatchEvent(new w.Event("input", { bubbles: true })); };
  var btn = function (text) { return Array.prototype.filter.call(main().querySelectorAll("button"), function (b) { return b.textContent.indexOf(text) === 0; })[0]; };

  console.log("Today");
  ok("the page renders the day at Hyderabad", /Mon 28 Sep 2026, Hyderabad/.test(main().querySelector("h2").textContent), main().querySelector("h2").textContent);
  ok("the dial is drawn", d.querySelectorAll("svg.dial path").length > 30, d.querySelectorAll("svg.dial path").length);
  ok("the pañcāṅga table carries tithi and nakṣatra", /Kṛṣṇa Dvitīyā/.test(main().textContent) && /Revatī|Aśvinī/.test(main().textContent));
  ok("six countdowns from the default dashboard", d.querySelectorAll(".clock").length === 6, d.querySelectorAll(".clock").length);
  ok("full view shows choghaḍiyā, horā and lagna bands", d.querySelectorAll(".band").length === 3 && /Lagna through the day/.test(main().textContent));
  ok("the address carries the context, or the page says it cannot", (/tab=today/.test(w.location.search) && /place=Hyderabad/.test(w.location.search)) || w.JyotishApp.state.addressFixed === true);

  console.log("Explainer");
  var xel = main().querySelector("table [data-x]"), dial = main().querySelector("svg.dial [data-x]");
  xel.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok("tapping a result opens its working", !!d.querySelector(".explain") && d.querySelectorAll(".explain li").length > 0);
  var provs = d.querySelectorAll(".explain .form button").length;
  ok("every configured provider is offered, plus copying", provs === w.JyotishConfig.ai.providers.length + 1, provs);
  d.querySelector(".explain .close").click();
  xel.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
  ok("right-click opens the menu with the working first", !!d.querySelector(".menu") && /Show the working/.test(d.querySelector(".menu").textContent));
  d.body.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  dial.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok("a segment of the dial explains itself too", !!d.querySelector(".explain"));
  d.querySelector(".explain .close").click();

  console.log("Calendar");
  tab("Calendar");
  var cells = d.querySelectorAll(".month .cell").length;
  ok("the month grid runs whole weeks", cells >= 28 && cells % 7 === 0, cells);
  ok("festivals appear in red ink", d.querySelectorAll(".month .f").length > 0);

  console.log("Festivals");
  tab("Festivals");
  var rows = main().querySelectorAll("table.grid tbody tr").length;
  ok("the year's observances are listed", rows > 60, rows);
  ok("Dīpāvalī is dated 8 Nov at Hyderabad", /Sun 8 Nov 2026/.test(Array.prototype.filter.call(main().querySelectorAll("tr"), function (r) { return /Dīpāvalī/.test(r.textContent); })[0].textContent));

  console.log("Śrāddha");
  tab("Śrāddha");
  btn("Use the dates of").click();
  await until(function () { return /Tithi of passing/.test(main().textContent) && /Special Śrāddhas/.test(main().textContent); }, 30000);
  ok("the dedication fills the calculator and it computes", /Tithi of passing/.test(main().textContent));
  ok("both candidate tithis are shown for an unrecorded hour", /Kṛṣṇa Amāvāsyā/.test(main().textContent) && /Śukla Pratipadā/.test(main().textContent));
  ok("the Pitṛ Pakṣa table carries sixteen days", main().querySelectorAll("table.grid")[1].querySelectorAll("tbody tr").length === 16);

  console.log("Kuṇḍalī");
  tab("Kuṇḍalī");
  var ins = main().querySelectorAll(".form input");
  setVal(ins[1], "1990-01-01"); setVal(ins[2], "10:30");
  btn("Cast the chart").click();
  await until(function () { return main().querySelector("svg.chart") && main().querySelectorAll("details.dasha").length; }, 30000);
  ok("the rāśi chart is drawn", main().querySelectorAll("svg.chart").length >= 1);
  ok("nine grahas in the table", main().querySelectorAll("table.grid tbody tr").length === 9);
  ok("the daśā tree opens on the running period", main().querySelectorAll("details.dasha").length >= 9 && main().querySelector(".cur"));
  var sels = main().querySelectorAll(".form select");
  ["south", "east"].forEach(function (st) { setVal(sels[1], st); });
  setVal(sels[2], "9");
  await until(function () { return main().querySelectorAll("svg.chart").length === 2; }, 30000);
  ok("East style with the navāṁśa beside it", main().querySelectorAll("svg.chart polygon").length >= 24);

  console.log("Match");
  tab("Match");
  var f = main().querySelectorAll("fieldset");
  setVal(f[0].querySelectorAll("input")[0], "1992-03-14"); setVal(f[0].querySelectorAll("input")[1], "07:15");
  setVal(f[1].querySelectorAll("input")[0], "1994-11-02"); setVal(f[1].querySelectorAll("input")[1], "19:30");
  btn("Run Monte Carlo").click();
  await until(function () { return main().querySelector("svg.hist"); }, 60000);
  ok("eight kūṭas scored", main().querySelectorAll("table.grid")[0].querySelectorAll("tbody tr").length === 8);
  ok("the Monte Carlo draws its distribution", main().querySelectorAll("svg.hist rect").length > 0);
  ok("the variance shares are reported", /Share of the spread/.test(main().textContent));

  console.log("Muhūrta");
  tab("Muhūrta");
  var mi = main().querySelectorAll(".form input"); setVal(main().querySelector(".form select"), "yatra"); setVal(mi[0], "2026-10-12"); setVal(mi[1], "7");
  btn("Find windows").click();
  await until(function () { return /Hours ruled out/.test(main().textContent); }, 60000);
  ok("windows are found and rejections counted", /Hours ruled out/.test(main().textContent) && main().querySelectorAll("table.grid tbody tr").length > 0);

  console.log("Music and Sources");
  tab("Music");
  ok("nine voices with pitches", main().querySelectorAll("table.grid tbody tr").length === 9 && /Hz/.test(main().textContent));
  tab("Sources");
  ok("the dedication is shown", /Dedicated to Shri Jyotish Chandra Chaudhuri/.test(main().textContent));
  ok("sources are listed", main().querySelectorAll("table.grid tbody tr").length === w.JyotishConfig.references.entries.length);

  ok("no script error anywhere", errors.length === 0, errors.slice(0, 3).join(" | "));
  console.log("\n" + pass + " passed, " + fail + " failed");
  w.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log("  FAIL harness: " + (e.stack || e)); process.exit(1); });
