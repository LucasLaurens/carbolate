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
 * gCO₂e per second of page load — proxy for device energy during navigation.
 * Based on a 15W laptop at ~30% CPU load above idle (≈ 4.5W incremental) × 442 gCO₂/kWh.
 */
export const CPU_FACTOR = 0.001;

/**
 * gCO₂e per second — GPU / display rendering overhead during active page load.
 * Based on integrated GPU at ~3W rendering load × 442 gCO₂/kWh.
 */
export const RENDERING_FACTOR = 0.0004;

/** Daily web-browsing CO₂ reference for an average internet user (ADEME 2023 / Shift Project 2022). */
export const WORLD_DAILY_BROWSING_G_CO2 = 120;
