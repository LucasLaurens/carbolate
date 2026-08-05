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
 * gCO₂e per second of page load — the user's machine while the page loads.
 *
 * House estimate: a laptop drawing ≈ 11 W above idle (CPU under load, plus the
 * integrated GPU and the display) × 442 gCO₂e/kWh.
 *
 * Replaces the former `CPU_FACTOR` (0.001) and `RENDERING_FACTOR` (0.0004).
 * Both multiplied the **same** value — the navigation duration — by two
 * coefficients, so the split described no second measurement, it only implied a
 * precision the input cannot carry. This factor is their sum, so what a stored
 * day totals to does not move.
 * See docs/decisions/2026-08-05-perimetre-modele-carbone.md
 */
export const DEVICE_FACTOR = 0.0014;

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
