/*!
 * jyotish-ephem.js  Chakra engine tier v2: the precise sky.
 *
 * VSOP87D planets (0.36" truncation), Meeus/ELP-2000 Moon, IAU 1980 nutation,
 * Espenak and Meeus Delta-T, light-time and aberration, sidereal time, ascendant,
 * rise and set with the horizon convention taken from configuration.
 * Every number derives from lib/data/jyotish-series.js, which a generator writes.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 * (c) 1993-2026 Abhishek Choudhary. All rights reserved. Sole author. AyeAI.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data/jyotish-series.js"));
  else root.JyotishEphem = factory(root.JyotishSeries);
})(typeof self !== "undefined" ? self : this, function (S) {
  "use strict";
  var VERSION = "2.0.0";
  var D2R = Math.PI / 180, R2D = 180 / Math.PI, J2000 = 2451545.0;
  var C_AU_DAY = 173.1446327;

  function rev(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function sind(x) { return Math.sin(x * D2R); }
  function cosd(x) { return Math.cos(x * D2R); }

  /* ---------- time ---------- */
  function jdFromCivil(Y, M, D, hours) {
    if (M <= 2) { Y -= 1; M += 12; }
    var A = Math.floor(Y / 100), B = 0;
    var greg = (Y > 1582) || (Y === 1582 && (M > 10 || (M === 10 && D >= 15)));
    if (greg) B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5 + (hours || 0) / 24;
  }
  function civilFromJd(jd) {
    var z = Math.floor(jd + 0.5), f = jd + 0.5 - z, A = z;
    if (z >= 2299161) { var al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), Dd = Math.floor(365.25 * C), E = Math.floor((B - Dd) / 30.6001);
    var day = B - Dd - Math.floor(30.6001 * E) + f, M = E < 14 ? E - 1 : E - 13, Y = M > 2 ? C - 4716 : C - 4715;
    var D = Math.floor(day), h = (day - D) * 24;
    return { Y: Y, M: M, D: D, hours: h };
  }
  /* Espenak and Meeus polynomials, as carried by pymeeus Epoch.tt2ut. Seconds. */
  function deltaT(jdUT) {
    var c = civilFromJd(jdUT), y = c.Y + (c.M - 0.5) / 12, t, u;
    if (y < -500) { u = (y - 1820) / 100; return -20 + 32 * u * u; }
    if (y < 500) { u = y / 100; return 10583.6 + u * (-1014.41 + u * (33.78311 + u * (-5.952053 + u * (-0.1798452 + u * (0.022174192 + 0.0090316521 * u))))); }
    if (y < 1600) { u = (y - 1000) / 100; return 1574.2 + u * (-556.01 + u * (71.23472 + u * (0.319781 + u * (-0.8503463 + u * (-0.005050998 + 0.0083572073 * u))))); }
    if (y < 1700) { t = y - 1600; return 120 + t * (-0.9808 + t * (-0.01532 + t / 7129)); }
    if (y < 1800) { t = y - 1700; return 8.83 + t * (0.1603 + t * (-0.0059285 + t * (0.00013336 - t / 1174000))); }
    if (y < 1860) { t = y - 1800; return 13.72 + t * (-0.332447 + t * (0.0068612 + t * (0.0041116 + t * (-0.00037436 + t * (0.0000121272 + t * (-0.0000001699 + 0.000000000875 * t)))))); }
    if (y < 1900) { t = y - 1860; return 7.62 + t * (0.5737 + t * (-0.251754 + t * (0.01680668 + t * (-0.0004473624 + t / 233174)))); }
    if (y < 1920) { t = y - 1900; return -2.79 + t * (1.494119 + t * (-0.0598939 + t * (0.0061966 - 0.000197 * t))); }
    if (y < 1941) { t = y - 1920; return 21.20 + t * (0.84493 + t * (-0.076100 + 0.0020936 * t)); }
    if (y < 1961) { t = y - 1950; return 29.07 + t * (0.407 + t * (-1 / 233 + t / 2547)); }
    if (y < 1986) { t = y - 1975; return 45.45 + t * (1.067 + t * (-1 / 260 - t / 718)); }
    if (y < 2005) { t = y - 2000; return 63.86 + t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + 0.00002373599 * t)))); }
    if (y < 2050) { t = y - 2000; return 62.92 + t * (0.32217 + 0.005589 * t); }
    if (y < 2150) { u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
    u = (y - 1820) / 100; return -20 + 32 * u * u;
  }
  function jde(jdUT) { return jdUT + deltaT(jdUT) / 86400; }

  /* ---------- nutation and obliquity (Meeus ch. 22) ---------- */
  var nutCache = { t: NaN, v: null };
  function nutation(JDE) {
    if (JDE === nutCache.t) return nutCache.v;
    var T = (JDE - J2000) / 36525;
    var D = 297.85036 + T * (445267.111480 + T * (-0.0019142 + T / 189474));
    var M = 357.52772 + T * (35999.050340 + T * (-0.0001603 - T / 300000));
    var Mp = 134.96298 + T * (477198.867398 + T * (0.0086972 + T / 56250));
    var F = 93.27191 + T * (483202.017538 + T * (-0.0036825 + T / 327270));
    var Om = 125.04452 + T * (-1934.136261 + T * (0.0020708 + T / 450000));
    var args = [D, M, Mp, F, Om], dpsi = 0, deps = 0, i, a, arg;
    for (i = 0; i < S.nutArg.length; i++) {
      a = S.nutArg[i]; arg = (a[0] * args[0] + a[1] * args[1] + a[2] * args[2] + a[3] * args[3] + a[4] * args[4]) * D2R;
      dpsi += (S.nutSin[i][0] + S.nutSin[i][1] * T) * Math.sin(arg);
      if (i < S.nutCos.length) deps += (S.nutCos[i][0] + S.nutCos[i][1] * T) * Math.cos(arg);
    }
    var eps0 = 23.439291111 + T * (-46.8150 + T * (-0.00059 + T * 0.001813)) / 3600;
    var v = { dpsi: dpsi / 36000000, deps: deps / 36000000, eps0: eps0 };
    v.eps = eps0 + v.deps;
    nutCache = { t: JDE, v: v };
    return v;
  }

  /* ---------- VSOP87D heliocentric, ecliptic of date ---------- */
  function vsopSeries(levels, tau) {
    var total = 0, p = 1, i, j, s, a;
    for (i = 0; i < levels.length; i++) {
      a = levels[i]; s = 0;
      for (j = 0; j < a.length; j += 3) s += a[j] * Math.cos(a[j + 1] + a[j + 2] * tau);
      total += s * p; p *= tau;
    }
    return total / 1e8;
  }
  function helio(body, JDE) {
    var t = S.vsop[body], tau = (JDE - J2000) / 365250;
    var L = vsopSeries(t.L, tau), B = vsopSeries(t.B, tau), R = vsopSeries(t.R, tau);
    var cb = Math.cos(B);
    return { L: L, B: B, R: R, x: R * cb * Math.cos(L), y: R * cb * Math.sin(L), z: R * Math.sin(B) };
  }
  function earthVelocity(JDE) {
    var h = 0.01, a = helio("Earth", JDE - h), b = helio("Earth", JDE + h);
    return { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h), z: (b.z - a.z) / (2 * h) };
  }
  function fk5(lon, lat, T) {                 /* Meeus 32.3, degrees in and out */
    var Lp = (lon - 1.397 * T - 0.00031 * T * T) * D2R;
    var dL = (-0.09033 + 0.03916 * (Math.cos(Lp) + Math.sin(Lp)) * Math.tan(lat * D2R)) / 3600;
    var dB = (0.03916 * (Math.cos(Lp) - Math.sin(Lp))) / 3600;
    return { lon: lon + dL, lat: lat + dB };
  }
  /* Apparent geocentric place of Sun or a planet: light-time, aberration, FK5, nutation. */
  function planetApparent(body, JDE) {
    var E = helio("Earth", JDE), P, x, y, z, dist, tau = 0, k;
    if (body === "Sun") { x = -E.x; y = -E.y; z = -E.z; dist = E.R; }
    else {
      for (k = 0; k < 3; k++) {
        P = helio(body, JDE - tau);
        x = P.x - E.x; y = P.y - E.y; z = P.z - E.z;
        dist = Math.sqrt(x * x + y * y + z * z); tau = 0.0057755183 * dist;
      }
    }
    var v = earthVelocity(JDE), ux = x / dist, uy = y / dist, uz = z / dist;
    var bx = v.x / C_AU_DAY, by = v.y / C_AU_DAY, bz = v.z / C_AU_DAY, dot = ux * bx + uy * by + uz * bz;
    ux += bx - ux * dot; uy += by - uy * dot; uz += bz - uz * dot;
    var lon = rev(Math.atan2(uy, ux) * R2D), lat = Math.atan2(uz, Math.sqrt(ux * ux + uy * uy)) * R2D;
    var T = (JDE - J2000) / 36525, f = fk5(lon, lat, T), n = nutation(JDE);
    return { lon: rev(f.lon + n.dpsi), lat: f.lat, dist: dist };
  }

  /* ---------- Moon, Meeus ch. 47 ---------- */
  function moonArgs(T) {
    return {
      Lp: 218.3164477 + T * (481267.88123421 + T * (-0.0015786 + T * (1 / 538841 - T / 65194000))),
      D: 297.8501921 + T * (445267.1114034 + T * (-0.0018819 + T * (1 / 545868 - T / 113065000))),
      M: 357.5291092 + T * (35999.0502909 + T * (-0.0001536 + T / 24490000)),
      Mp: 134.9633964 + T * (477198.8675055 + T * (0.0087414 + T * (1 / 69699.9 + T / 14712000))),
      F: 93.2720950 + T * (483202.0175233 + T * (-0.0036539 + T * (-1 / 3526000 + T / 863310000)))
    };
  }
  function moonGeometric(JDE) {
    var T = (JDE - J2000) / 36525, a = moonArgs(T);
    var A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
    var E = 1 + T * (-0.002516 - 0.0000074 * T), sl = 0, sr = 0, sb = 0, i, r, arg, e;
    for (i = 0; i < S.moonLR.length; i++) {
      r = S.moonLR[i]; arg = (r[0] * a.D + r[1] * a.M + r[2] * a.Mp + r[3] * a.F) * D2R;
      e = r[1] === 0 ? 1 : (Math.abs(r[1]) === 1 ? E : E * E);
      sl += r[4] * e * Math.sin(arg); sr += r[5] * e * Math.cos(arg);
    }
    for (i = 0; i < S.moonB.length; i++) {
      r = S.moonB[i]; arg = (r[0] * a.D + r[1] * a.M + r[2] * a.Mp + r[3] * a.F) * D2R;
      e = r[1] === 0 ? 1 : (Math.abs(r[1]) === 1 ? E : E * E);
      sb += r[4] * e * Math.sin(arg);
    }
    sl += 3958 * sind(A1) + 1962 * sind(a.Lp - a.F) + 318 * sind(A2);
    sb += -2235 * sind(a.Lp) + 382 * sind(A3) + 175 * sind(A1 - a.F) + 175 * sind(A1 + a.F) + 127 * sind(a.Lp - a.Mp) - 115 * sind(a.Lp + a.Mp);
    return { lon: rev(a.Lp + sl / 1e6), lat: sb / 1e6, distKm: 385000.56 + sr / 1000 };
  }
  function moonApparent(JDE) {
    var g = moonGeometric(JDE), n = nutation(JDE);
    return { lon: rev(g.lon + n.dpsi), lat: g.lat, distKm: g.distKm, parallax: Math.asin(6378.14 / g.distKm) * R2D };
  }
  /* Lunar nodes. Mean: Meeus 47.7. True: the osculating node, the line where the plane of
     the Moon's instantaneous orbit (r x v, from the lunar series) meets the ecliptic of date.
     Apparent = + dpsi, as for every other body. */
  function moonVec(JDE) {
    var g = moonGeometric(JDE), cl = cosd(g.lat);
    return [g.distKm * cl * cosd(g.lon), g.distKm * cl * sind(g.lon), g.distKm * sind(g.lat)];
  }
  function nodeLon(JDE, kind) {
    var T = (JDE - J2000) / 36525, om;
    if (kind === "true") {
      var h = 0.005, r = moonVec(JDE), a = moonVec(JDE - h), b = moonVec(JDE + h);
      var v = [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)];
      var hx = r[1] * v[2] - r[2] * v[1], hy = r[2] * v[0] - r[0] * v[2];
      om = Math.atan2(hx, -hy) * R2D;
    } else {
      om = 125.0445479 + T * (-1934.1362891 + T * (0.0020754 + T * (1 / 476441 - T / 60616000)));
    }
    return rev(om + nutation(JDE).dpsi);
  }

  /* ---------- ayanamsha: a value at an epoch, carried by general precession (IAU 1976) ----------
     Lahiri: 23 deg 15' 00.658" at 1956-03-21 0h (Calendar Reform Committee), a TRUE value; the mean
     ayanamsha is that less the nutation in longitude at the epoch, which this engine computes. */
  var LAHIRI = { id: "lahiri", t0: 2435553.5, value: 23.250182778, lessNutationAtT0: true };
  function precessionLon(JDE) { var T = (JDE - J2000) / 36525; return (5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T) / 3600; }
  function ayanamsha(JDE, def) {
    def = def || LAHIRI;
    var v0 = def.value - (def.lessNutationAtT0 ? nutation(def.t0).dpsi : 0);
    return v0 + precessionLon(JDE) - precessionLon(def.t0);
  }
  /* sidereal = apparent tropical minus (mean ayanamsha + dpsi): nutation cancels */
  function sidereal(apparentLon, JDE, def) { return rev(apparentLon - ayanamsha(JDE, def) - nutation(JDE).dpsi); }

  /* ---------- sidereal time, equatorial, horizon ---------- */
  function gmst(jdUT) {
    var T = (jdUT - J2000) / 36525;
    return rev(280.46061837 + 360.98564736629 * (jdUT - J2000) + T * T * (0.000387933 - T / 38710000));
  }
  function gast(jdUT) { var n = nutation(jde(jdUT)); return rev(gmst(jdUT) + n.dpsi * cosd(n.eps)); }
  function toEquatorial(lon, lat, eps) {
    var ra = Math.atan2(sind(lon) * cosd(eps) - Math.tan(lat * D2R) * sind(eps), cosd(lon)) * R2D;
    var dec = Math.asin(sind(lat) * cosd(eps) + cosd(lat) * sind(eps) * sind(lon)) * R2D;
    return { ra: rev(ra), dec: dec };
  }
  function ascendant(jdUT, latDeg, lonDeg) {
    var n = nutation(jde(jdUT)), ramc = rev(gast(jdUT) + lonDeg), e = n.eps;
    var asc = Math.atan2(cosd(ramc), -(sind(ramc) * cosd(e) + Math.tan(latDeg * D2R) * sind(e))) * R2D;
    var mc = Math.atan2(sind(ramc), cosd(ramc) * cosd(e)) * R2D;
    return { asc: rev(asc), mc: rev(mc), ramc: ramc, eps: e };
  }

  /* body in {Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune} */
  function apparent(body, jdUT) {
    var J = jde(jdUT);
    return body === "Moon" ? moonApparent(J) : planetApparent(body, J);
  }
  function altitude(body, jdUT, lat, lon) {
    var p = apparent(body, jdUT), n = nutation(jde(jdUT)), q = toEquatorial(p.lon, p.lat, n.eps);
    var H = gast(jdUT) + lon - q.ra;
    return { alt: Math.asin(sind(lat) * sind(q.dec) + cosd(lat) * cosd(q.dec) * cosd(H)) * R2D, parallax: p.parallax || 0 };
  }
  var HORIZON = { "upper-limb-refracted": -0.8333, "centre-refracted": -0.5667, "centre-geometric": 0 };
  /* def is a named convention or a number of degrees taken from configuration */
  function horizonFor(body, def, parallax) {
    if (body === "Moon") return 0.7275 * parallax - 0.5667;
    if (typeof def === "number") return def;
    return HORIZON[def || "upper-limb-refracted"];
  }
  /* All crossings of the horizon in [jd0, jd1): kind 'rise' or 'set'. */
  function crossings(body, jd0, jd1, lat, lon, def) {
    /* the Sun is bracketed in 2-hour steps, the Moon in 1-hour steps; bisection stops below 0.5 s */
    var out = [], step = body === "Sun" ? 1 / 12 : 1 / 24, t = jd0, f = function (x) { var a = altitude(body, x, lat, lon); return a.alt - horizonFor(body, def, a.parallax); };
    var fa = f(t), fb, a, b, m, fm, k;
    for (; t < jd1; t += step) {
      fb = f(t + step);
      if ((fa < 0) !== (fb < 0)) {
        a = t; b = t + step; var fa0 = fa;
        for (k = 0; k < 40 && b - a > 5e-6; k++) { m = (a + b) / 2; fm = f(m); if ((fa0 < 0) !== (fm < 0)) b = m; else { a = m; fa0 = fm; } }
        out.push({ jd: (a + b) / 2, kind: fa < 0 ? "rise" : "set" });
      }
      fa = fb;
    }
    return out;
  }
  function riseSet(body, jdLocalMidnightUT, lat, lon, def) {
    var c = crossings(body, jdLocalMidnightUT, jdLocalMidnightUT + 1, lat, lon, def), r = null, s = null, i;
    for (i = 0; i < c.length; i++) { if (c[i].kind === "rise" && r === null) r = c[i].jd; if (c[i].kind === "set" && s === null) s = c[i].jd; }
    return { rise: r, set: s };
  }

  var GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  /* Sidereal positions and daily speed for the nine grahas (+ optional outer). */
  function grahas(jdUT, opt) {
    opt = opt || {};
    var J = jde(jdUT), out = {}, dt = 0.5, list = GRAHAS.concat(opt.outer ? ["Uranus", "Neptune"] : []), i, b, p0, p1, p;
    for (i = 0; i < list.length; i++) {
      b = list[i]; p = apparent(b, jdUT);
      p0 = apparent(b, jdUT - dt); p1 = apparent(b, jdUT + dt);
      var sp = ((p1.lon - p0.lon + 540) % 360 - 180) / (2 * dt);
      out[b] = { lon: sidereal(p.lon, J, opt.ayanamsha), tropical: p.lon, lat: p.lat, speed: sp, retro: sp < 0 };
    }
    var nk = opt.node === "mean" ? "mean" : "true", ra = nodeLon(J, nk), ra1 = nodeLon(J + dt, nk), ra0 = nodeLon(J - dt, nk);
    var rs = ((ra1 - ra0 + 540) % 360 - 180) / (2 * dt);
    out.Rahu = { lon: sidereal(ra, J, opt.ayanamsha), tropical: ra, lat: 0, speed: rs, retro: rs < 0, node: nk };
    out.Ketu = { lon: rev(out.Rahu.lon + 180), tropical: rev(ra + 180), lat: 0, speed: rs, retro: rs < 0, node: nk };
    return out;
  }
  function sunLon(jdUT) { return planetApparent("Sun", jde(jdUT)).lon; }
  function moonLon(jdUT) { return moonApparent(jde(jdUT)).lon; }

  return {
    VERSION: VERSION, rev: rev, jdFromCivil: jdFromCivil, civilFromJd: civilFromJd, deltaT: deltaT, jde: jde,
    nutation: nutation, helio: helio, apparent: apparent, planetApparent: planetApparent, moonApparent: moonApparent,
    moonGeometric: moonGeometric, nodeLon: nodeLon, ayanamsha: ayanamsha, sidereal: sidereal, gmst: gmst, gast: gast,
    toEquatorial: toEquatorial, ascendant: ascendant, altitude: altitude, crossings: crossings, riseSet: riseSet,
    horizonFor: horizonFor, HORIZON: HORIZON, LAHIRI: LAHIRI, grahas: grahas, sunLon: sunLon, moonLon: moonLon, GRAHAS: GRAHAS,
    meta: S.meta
  };
});
