type DomainResult = { valid: true; domain: string } | { valid: false };

/**
 * Suffixes that are two labels long, so a site under them needs three to be
 * itself. A **house heuristic, deliberately not a Public Suffix List**: the PSL
 * would cost ~80 KB in an extension whose subject is the weight of the web, and
 * being wrong on an exotic suffix costs one misfiled resource.
 * See docs/decisions/2026-08-05-page-visit-unite-de-mesure.md
 */
const TWO_PART_SUFFIXES = ["co.uk", "com.br", "co.jp", "com.au", "co.nz", "co.za", "com.mx"];

export function parseDomain(url: string): DomainResult {
  if (!URL.canParse(url)) return { valid: false };
  const { hostname, protocol } = new URL(url);
  if (!["http:", "https:"].includes(protocol)) return { valid: false };
  if (!hostname) return { valid: false };
  return { valid: true, domain: hostname };
}

/**
 * The part of a host that identifies who owns it: the last two labels, or three
 * under a known two-part suffix.
 *
 * O(1) time and space — the suffix list is a fixed handful.
 */
export function readRegistrableDomain(hostname: string): string {
  const labels = hostname.split(".");
  if (labels.length <= 2) return hostname;

  const lastTwo = labels.slice(-2).join(".");
  const depth = TWO_PART_SUFFIXES.includes(lastTwo) ? 3 : 2;
  return labels.slice(-depth).join(".");
}

/**
 * Whether a resource was served by someone other than the page's owner.
 *
 * Anything that cannot be read as a host — `data:`, `blob:`, a malformed URL —
 * counts as **first-party**: those bytes are the document's own, and inventing a
 * third party from an unparseable name would inflate the very figure this is
 * meant to make honest.
 *
 * Known limits, written rather than discovered: a house CDN on a different
 * registrable domain reads as third-party, and `PerformanceResourceTiming.name`
 * is the **initial** URL of a redirect chain, so a first-party URL redirecting
 * to a third-party host reads as first-party.
 *
 * O(1) time and space.
 */
export function isThirdPartyResource(resourceUrl: string, pageHostname: string): boolean {
  const parsed = parseDomain(resourceUrl);
  if (!parsed.valid) return false;
  return readRegistrableDomain(parsed.domain) !== readRegistrableDomain(pageHostname);
}
