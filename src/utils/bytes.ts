/**
 * Byte and duration conversions — base 10 only.
 *
 * Every published carbon source expresses energy per **base-10** gigabyte
 * (`kWh/GB` with `1 GB = 10⁹ bytes`), and `CARBON_PER_GB` derives from one of
 * them. Introducing base-2 units (MiB, GiB) anywhere would silently offset the
 * displayed figures by 4.9 % per order of magnitude.
 *
 * See docs/decisions/2026-08-05-unites-et-retention.md
 */

export const BYTES_PER_MB = 1_000_000;
export const BYTES_PER_GB = 1_000_000_000;
export const MS_PER_SECOND = 1_000;

export const bytesToMegabytes = (bytes: number): number => bytes / BYTES_PER_MB;

export const megabytesToBytes = (megabytes: number): number => megabytes * BYTES_PER_MB;

export const bytesToGigabytes = (bytes: number): number => bytes / BYTES_PER_GB;

export const millisecondsToSeconds = (ms: number): number => ms / MS_PER_SECOND;

export const secondsToMilliseconds = (seconds: number): number => seconds * MS_PER_SECOND;
