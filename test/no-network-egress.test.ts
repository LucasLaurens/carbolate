import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The privacy policy (`docs/privacy/index.html`) claims in writing that the
 * extension makes no network request. That claim is published at a public URL and
 * cross-checked by store reviewers, so it gets an assertion rather than a promise:
 * this test fails the day an egress API or an external address appears in `src/`.
 */
const EGRESS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bsendBeacon\b/,
  /\bEventSource\b/,
  /\bnavigator\.connection\b/,
  /chrome\.storage\.sync\b/,
  /https?:\/\//,
];

/** O(n) time in bytes of source, O(1) space beyond the file being read. */
function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) yield path;
  }
}

describe("no network egress", () => {
  it("keeps src/ free of any egress API or external address", () => {
    // Arrange
    const offenders: string[] = [];

    // Act
    for (const path of sourceFiles("src")) {
      const source = readFileSync(path, "utf8");
      for (const pattern of EGRESS) {
        if (pattern.test(source)) offenders.push(`${path} matches ${pattern}`);
      }
    }

    // Assert
    expect(offenders).toEqual([]);
  });
});
