/** Global average grid carbon intensity, gCO₂e per kWh (IEA 2023). */
export const GRID_INTENSITY_G_CO2_PER_KWH = 442;

/**
 * Energy consumed per GB by data centers + transmission networks (IEA 2023 / ADEME 2023).
 * Updated from 0.75 kWh/GB (2019 Shift Project) to 0.4 kWh/GB (2022–2023 consensus).
 */
export const NETWORK_ENERGY_KWH_PER_GB = 0.4;

/** gCO₂e per GB of data transferred (network infrastructure + data centers). */
export const CARBON_PER_GB = NETWORK_ENERGY_KWH_PER_GB * GRID_INTENSITY_G_CO2_PER_KWH; // 176.8

/**
 * gCO₂e per second of page load — the CPU and the GPU of the user's machine.
 *
 * House estimate, and said to be one: 11.40 W of total machine draw is what the
 * former single 0.0014 factor implied, and 3.4 W of it is the sourced panel
 * figure below, so 8.0 W remains for everything else. Nothing publishes that
 * 8 W — it is the subtraction, not a measurement. At ≈ 0.003 g per page it is
 * too small to justify blocking on a source and too real to delete.
 *
 * Replaces the former `CPU_FACTOR` (0.001) and `RENDERING_FACTOR` (0.0004),
 * which multiplied the **same** navigation duration by two coefficients.
 * See docs/decisions/2026-09-15-energie-ecran.md
 */
export const DEVICE_FACTOR = 0.00098;

/**
 * gCO₂e per second the screen stayed lit — 3.4 W of panel draw, the
 * Fraunhofer/DOE parc average for a display alone, × 442 gCO₂e/kWh.
 *
 * Sourced rather than derived from a diagonal: the EU Commission's 1.0 W/dm²
 * would need the physical size of the panel, which no browser API exposes and
 * which the perimeter ADR forbids inventing from a resolution.
 *
 * `DEVICE_FACTOR + SCREEN_FACTOR === 0.0014`, the factor that shipped before
 * the split — naming the panel separately renames a share, it does not add one,
 * so no stored day moves.
 *
 * **Attributional, not avoidable.** It charges a share of a screen that was
 * already on; closing the tab does not turn it off. See docs/glossary.md.
 *
 * Applied to the load duration for now, the only lit time the extension can
 * observe; issue #40 widens the input to the whole display time without
 * touching this factor.
 */
export const SCREEN_FACTOR = 0.00042;

/**
 * Average daily web-browsing footprint of an internet user, gCO₂e
 * (ADEME 2023 / Shift Project 2022).
 *
 * The single anchor of the presentation layer: the sobriety thresholds are
 * multiples of it, and the world comparison is a position against it. Changing
 * it moves both — deliberately, since one piece of knowledge has one home.
 */
export const DAILY_BROWSING_REFERENCE_G_CO2 = 120;

/**
 * Multipliers applied to the reference to obtain the sobriety thresholds
 * (60 / 180 / 480 gCO₂e).
 *
 * **A design choice, not a source.** No study says at what point browsing
 * becomes excessive. What is sourced is the anchor; these are normative, and the
 * glossary says so rather than dressing them up as measurement.
 */
export const SOBRIETY_MULTIPLIERS = {
  sober: 0.5,
  moderate: 1.5,
  intensive: 4,
} as const;

/**
 * Band edges of the world comparison, as multiples of the reference — a design
 * choice for the same reason. Wide enough that the ~20–25 % perimeter gap
 * between an usage-only figure and a full-perimeter reference cannot on its own
 * flip a verdict.
 */
export const WORLD_COMPARISON_MULTIPLIERS = {
  wellBelow: 0.5,
  below: 0.9,
  around: 1.1,
  above: 2,
} as const;
