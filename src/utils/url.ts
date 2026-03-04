export function parseDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
