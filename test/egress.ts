import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every way this codebase could reach the network, as the identifiers that
 * survive both authoring and minification.
 *
 * This is the single home of the list: the source tree and the built bundle are
 * scanned with the same patterns, so a new one cannot be added to one check and
 * forgotten in the other.
 */
export const EGRESS_APIS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\b/,
  /\bEventSource\b/,
  /\bnavigator\.connection\b/,
  /chrome\.storage\.sync\b/,
] as const;

/** An address that is not this extension's own. */
export const EXTERNAL_ADDRESS = /https?:\/\//;

/** O(n) time in bytes scanned, O(1) space beyond the file being read. */
function* findFiles(dir: string, extensions: readonly string[]): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* findFiles(path, extensions);
      continue;
    }
    if (extensions.some((extension) => entry.endsWith(extension))) yield path;
  }
}

export type Scan = {
  dir: string;
  extensions: readonly string[];
  patterns: readonly RegExp[];
  /** Files to leave out, by exact path. Test files describe egress, they do not perform it. */
  skip?: (path: string) => boolean;
};

/**
 * Every place a scanned file matches a forbidden pattern, as readable lines.
 *
 * O(n × p) time — n = bytes scanned, p = patterns — and O(1) space beyond the
 * offenders themselves.
 */
export function findEgressOffenders({ dir, extensions, patterns, skip }: Scan): string[] {
  const offenders: string[] = [];
  for (const path of findFiles(dir, extensions)) {
    if (skip?.(path) === true) continue;
    const source = readFileSync(path, "utf8");
    for (const pattern of patterns) {
      if (pattern.test(source)) offenders.push(`${path} matches ${String(pattern)}`);
    }
  }
  return offenders;
}
