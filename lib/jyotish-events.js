/*!
 * jyotish-events.js  The next time anything happens, and calendars to carry it.
 *
 * Every countdown card on the dashboard, in the installed app and in a home-screen
 * widget asks this module one question: when is the next X? Kinds are listed in
 * config/widgets.json. Exports iCalendar (RFC 5545) text for any list of events.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JyotishEvents = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  function create(P, C, cfg) {
    var E = P.E, PC = cfg.panchang;
    function today(now, place) { return C.ymd(now, place.tz); }
    function frameAfter(now, place, pick) {
      for (var k = 0; k < 3; k++) {
        var d = C.addDays(today(now, place), k), f = P.frame(d[0], d[1], d[2], place);
        if (f.polar) continue;
        var t = pick(f); if (t !== null && t > now) return { at: t, date: d, f: f };
      }
      return null;
    }
    var solveTo = function (target, now) { return P.solve(function (t) { return P.sky(t).elong; }, target, now + 1e-6, 12.19, 1); };
    function next(kind, now, place, arg) {
      var r, s, L;
      switch (kind) {
        case "sunrise": r = frameAfter(now, place, function (f) { return f.sunrise; }); return r && { at: r.at, label: "Sunrise" };
        case "sunset": r = frameAfter(now, place, function (f) { return f.sunset; }); return r && { at: r.at, label: "Sunset" };
        case "moonrise": case "moonset":
          var c = E.crossings("Moon", now, now + 2, place.lat, place.lon).filter(function (x) { return x.kind === kind.slice(4); })[0];
          return c ? { at: c.jd, label: kind === "moonrise" ? "Moonrise" : "Moonset" } : null;
        case "tithi-end": s = P.span("tithi", now); L = P.tithiName(s.idx); return { at: s.end, label: L.pakshaName + " " + L.name + " ends" };
        case "nakshatra-end": s = P.span("nakshatra", now); return { at: s.end, label: PC.nakshatra[s.idx].name + " ends" };
        case "yoga-end": s = P.span("yoga", now); return { at: s.end, label: PC.yoga[s.idx] + " ends" };
        case "karana-end": s = P.span("karana", now); return { at: s.end, label: P.karanaName(s.idx) + " ends" };
        case "purnima": return { at: P.fullMoonAfter(now), label: "Full moon, end of Pūrṇimā" };
        case "amavasya": return { at: P.newMoonAfter(now), label: "New moon, end of Amāvāsyā" };
        case "ekadashi": var a = solveTo(120, now), b = solveTo(300, now); return { at: Math.min(a, b), label: (a < b ? "Śukla" : "Kṛṣṇa") + " Ekādaśī begins" };
        case "sankranti": var t = P.sankrantiAfter(now); return { at: t, label: "Sun enters " + PC.rashi[Math.floor(P.sky(t + 0.01).sunSid / 30)].name };
        case "rahu-kaal": case "abhijit": case "brahma":
          var key = kind === "rahu-kaal" ? "rahu" : kind;
          r = frameAfter(now, place, function (f) { var sg = P.segments(f); return sg ? sg[key].start : null; });
          return r && { at: r.at, label: { rahu: "Rāhu Kāla begins", abhijit: "Abhijit begins", brahma: "Brahma muhūrta begins" }[key] };
        case "festival":
          var y = today(now, place)[0], list = C.festivals(y, place).concat(C.festivals(y + 1, place)), dnow = C.key(today(now, place));
          var hit = list.filter(function (x) { return x.id === arg && x.date >= dnow; })[0];
          if (!hit) return null;
          var w = hit.windows && hit.windows[0], f = P.frame(hit.ymd[0], hit.ymd[1], hit.ymd[2], place);
          var at = w ? (w.at !== undefined ? w.at : w.start) : f.sunrise;
          return { at: at, label: hit.name, date: hit.date };
        case "custom": return arg ? { at: arg.at, label: arg.label || "Custom" } : null;
        default: return null;
      }
    }
    function stamp(jd) {
      var c = E.civilFromJd(jd), s = Math.round(c.hours * 3600), p = function (n) { return (n < 10 ? "0" : "") + n; };
      var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      if (h === 24) { var n = E.civilFromJd(jd + 1e-6); return n.Y + p(n.M) + p(n.D) + "T000000Z"; }
      return c.Y + p(c.M) + p(c.D) + "T" + p(h) + p(m) + p(sec) + "Z";
    }
    function esc(x) { return String(x).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
    function fold(line) { var out = [], i = 0; while (line.length - i > 73) { out.push((i ? " " : "") + line.slice(i, i + 73)); i += 73; } out.push((i ? " " : "") + line.slice(i)); return out.join("\r\n"); }
    /* events: [{start, end?, summary, description?, uid?}] with times as JD UT */
    function ics(events, name, nowJd) {
      var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AyeAI//Jyotish//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + esc(name || "Jyotish")];
      events.forEach(function (ev, i) {
        lines.push("BEGIN:VEVENT", "UID:" + (ev.uid || ("jyotish-" + Math.round(ev.start * 86400) + "-" + i + "@jyotish.local")), "DTSTAMP:" + stamp(nowJd || ev.start),
                   "DTSTART:" + stamp(ev.start), "DTEND:" + stamp(ev.end || ev.start + 1 / 1440), fold("SUMMARY:" + esc(ev.summary)));
        if (ev.description) lines.push(fold("DESCRIPTION:" + esc(ev.description)));
        lines.push("END:VEVENT");
      });
      lines.push("END:VCALENDAR");
      return lines.join("\r\n") + "\r\n";
    }
    return { next: next, ics: ics, stamp: stamp };
  }
  return { create: create };
});
