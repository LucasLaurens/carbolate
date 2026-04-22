type DomainResult = { valid: true; domain: string } | { valid: false };

export function parseDomain(url: string): DomainResult {
  if (!URL.canParse(url)) return { valid: false };
  const { hostname, protocol } = new URL(url);
  if (!["http:", "https:"].includes(protocol)) return { valid: false };
  if (!hostname) return { valid: false };
  return { valid: true, domain: hostname };
}
