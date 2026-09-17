import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EGRESS_APIS, EXTERNAL_ADDRESS, findEgressOffenders } from "../../test/egress";

/**
 * The privacy policy (`docs/privacy/index.html`) claims in writing that the
 * extension makes no network request. That claim is published at a public URL and
 * cross-checked by store reviewers, so it gets an assertion rather than a promise.
 *
 * Three scans, because the claim is about three different things: the code we
 * write, the tooling that builds it, and the bundle a user actually installs.
 * The last is the only one that covers a dependency — React and Chart.js reach
 * the browser too, and no amount of discipline in `src/` says anything about them.
 */
const DIST = "dist";

const isTestFile = (path: string): boolean => path.includes(".test.");

describe("no network egress", () => {
  it("keeps src/ free of any egress API or external address", () => {
    // Act
    const offenders = findEgressOffenders({
      dir: "src",
      extensions: [".ts", ".tsx"],
      patterns: [...EGRESS_APIS, EXTERNAL_ADDRESS],
      skip: isTestFile,
    });

    // Assert
    expect(offenders).toEqual([]);
  });

  /**
   * Build tooling runs on a developer's machine and in CI, where a request would
   * be a supply-chain step nobody reviewed. Addresses are not forbidden here:
   * `verify-csv-export.sh` seeds a fixture visit to `example.com`, which is data,
   * not a destination.
   */
  it("keeps the build scripts free of any egress API", () => {
    // Act
    const offenders = findEgressOffenders({
      dir: "scripts",
      extensions: [".mjs", ".js", ".ts", ".sh", ".py"],
      patterns: EGRESS_APIS,
    });

    // Assert
    expect(offenders).toEqual([]);
  });

  /**
   * The bundle is the claim's real subject, and it is checked wherever it exists:
   * always in CI, which builds before it tests, and locally for anyone who has
   * run a build. Vite's modulepreload polyfill used to put a `fetch` in here that
   * no scan of `src/` could ever have seen — see `vite.config.ts`.
   *
   * Addresses are not forbidden either: React carries XML namespace constants
   * (`http://www.w3.org/2000/svg`) that are identifiers, not destinations. With
   * every request API absent, a string that looks like a URL has nothing to call it.
   */
  it.runIf(existsSync(DIST) || process.env.CI !== undefined)(
    "keeps the shipped bundle free of any egress API, dependencies included",
    () => {
      // Act
      const offenders = findEgressOffenders({
        dir: DIST,
        extensions: [".js", ".html", ".css"],
        patterns: EGRESS_APIS,
      });

      // Assert
      expect(offenders).toEqual([]);
    },
  );

  /** A stylesheet or a page can fetch on its own, with no JavaScript involved. */
  it.runIf(existsSync(DIST) || process.env.CI !== undefined)(
    "leaves no external address for the panel's markup or styles to load",
    () => {
      // Act
      const offenders = findEgressOffenders({
        dir: DIST,
        extensions: [".html", ".css"],
        patterns: [EXTERNAL_ADDRESS],
      });

      // Assert
      expect(offenders).toEqual([]);
    },
  );
});
