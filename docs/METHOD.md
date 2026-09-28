# How Jyotish computes

Every number on the page comes from the steps below. The sources named are in `config/references.json`; the page shows the same working for any single result.

## Three traditions of reckoning

The Surya Siddhanta computes mean places from long cycles and corrects them with its own equations; its sidereal year and epoch at Lanka sunrise give places that drift from the observed sky by degrees over centuries (Burgess 1860). Drik Ganita, the reckoning the Calendar Reform Committee adopted in 1955, takes the places that are actually seen and applies the traditional definitions to them. Jyotish is Drik: the sky comes from modern theories of the Sun, Moon and planets, and the tithi, nakshatra, masa and every other limb keep their classical definitions. A Surya Siddhanta mode beside it is owed in `roadmap.json`.

## Time

Civil time converts to Universal Time with the place's fixed UTC offset; daylight saving is not modelled. Terrestrial Time adds Delta-T from the Espenak and Meeus polynomials, which are extrapolation after 2005 and differ from the observed value by a few seconds.

## The Sun and the planets

Heliocentric longitude, latitude and radius come from VSOP87D, the solution for the ecliptic and equinox of date (Bretagnon and Francou 1988). Terms whose amplitude falls below 1e-7 radian are dropped, which costs at most 0.36″ from 1800 to 2200, as `tools/gen_tables.py` measures against the full series.

The geocentric place of a planet takes the planet at the time its light left (light-time, iterated three times) as seen from the Earth now. Annual aberration is applied as a vector, from the Earth's velocity. A small correction takes the VSOP frame to FK5 (Meeus 32.3), and the IAU 1980 nutation in longitude, 63 terms, gives the apparent place on the true equinox of date.

## The Moon

The Moon's longitude, latitude and distance come from the 120 principal terms of ELP-2000/82 as Meeus gives them (Tables 47.A and 47.B). The mean node follows Meeus 47.7. The true node is the osculating node: the line where the plane of the Moon's instantaneous orbit, from its position and velocity, meets the ecliptic.

## Ayanamsha

Lahiri's value is 23° 15′ 00.658″ at 1956-03-21 0h, as the Calendar Reform Committee fixed it. That is a true value, so the mean ayanamsha at that date is the figure less the day's nutation in longitude, which the engine computes. General precession (IAU 1976) carries it to any date. A sidereal longitude is the apparent tropical longitude less the mean ayanamsha and the nutation, so nutation cancels.

## Rising and setting

Altitude comes from the apparent place, the apparent sidereal time and the latitude. Sunrise is the instant the Sun's altitude crosses the horizon named in `config/schools.json`: by default the upper limb with refraction (−0.8333°). The Moon's horizon is 0.7275 times its parallax less 34′. Crossings are bracketed hourly and bisected to below a second.

## The five limbs

The tithi is the Moon's elongation from the Sun in steps of 12°, the karana half a tithi, the nakshatra the Moon's sidereal longitude in steps of 13° 20′, and the yoga the sum of the two sidereal longitudes in the same steps. Each boundary is found by Newton's method on the angle, to below a second. The day runs from sunrise to sunrise. A tithi containing no sunrise is kshaya and one containing two is vriddhi.

## The month and the year

A lunation runs from new moon to new moon. It is named for the sign the Sun enters during it. With no sankranti inside it, it is adhika; with two, a month is kshaya. In purnimanta reckoning the dark fortnight carries the next month's name. The year begins with the Chaitra lunation: Vikrama is its Gregorian year plus 57, Shaka is Vikrama less 135, Kali is Shaka plus 3179, and the samvatsara is (Shaka + 11) mod 60 in the southern reckoning.

## The windows of the day

Daylight is cut into eight parts for Rahu Kala, Yamaganda and Gulika, into fifteen muhurtas for Abhijit, Kutapa and Rauhina, and into five for Madhyahna and Aparahna. The night is cut into fifteen for Brahma muhurta and Nishitha, and its first fifth is Pradosha. The first choghadiya of the day belongs to the weekday's lord and the first of the night to the lord of the fifth weekday; each sequence follows the hora order. The lagna table is the sidereal ascendant's sign crossings through the day.

## Observances

A rule names a month (amanta), a paksha, a tithi and a window in which the tithi must hold. The engine finds the tithi's real span in that lunation, measures how long it holds the window on each candidate day, and chooses under the rule's preference: the day whose sunrise falls inside the tithi, or the day holding it longest. A kshaya tithi falls back to the day that holds most of it. The puja window is the rule's window within the tithi, with Bhadra removed where the rule says so; when Bhadra covers it all, the window moves to after Bhadra ends. Every rule carries its status: two are partial and say what is missing.

## Shraddh

The tithi of death is the tithi at the instant of death, or every tithi of the civil day when the hour is not recorded. Its yearly date is the day whose aparahna holds that tithi longest, in the lunation of the same amanta name. Pitru Paksha is the dark fortnight of Bhadrapada (amanta) with the full moon before it. Maha Bharani and Magha are the days of the fortnight whose aparahna holds those nakshatras longest.

## Kundali and matching

Houses are whole signs from the lagna, and bhavas are Sripati's, from the trisected quadrants between the lagna and the meridian. Dignity, friendship and combustion follow `config/kundali.json`. Divisional signs come from Chakra's own code. A Vimshottari period is its parent's length times the sub-lord's years over 120.

Ashtakoota takes each Moon's sign, nakshatra and pada from its longitude, never from the nakshatra alone, and Graha Maitri uses the lords of the two Moon signs. Two tables are marked as sources that differ, and one as partial. The Monte Carlo samples each birth time uniformly within its stated window, and optionally each place within a stated radius. It recomputes the Moon and the lagna exactly for every sample, and moves Mars and Venus at their daily rate. Its generator is seeded, so a run can be repeated exactly.

## Muhurta

The day is cut wherever anything the occasion's rules examine changes. Each piece passes or fails the hard rules; passing pieces are joined and ranked by the soft preferences, and every failure is counted by its rule.

## Measured accuracy

The table in `README.md` is measured by `tests/run.js` against an independent ephemeris on every run, and the bounds published in `config/jyotish.config.json` are checked against that measurement.
