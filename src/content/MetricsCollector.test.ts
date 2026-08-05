import { describe, it, expect } from "vitest";
import { MetricsCollector } from "./MetricsCollector";
import type { ObservationSink, PerformanceSource } from "./MetricsCollector";
import type {
  NavigationTiming,
  PagePerformancePayload,
  ResourceTiming,
} from "../performance/PageMetrics";
import { PerformanceEntryType } from "../performance/enums/PerformanceEntryType";
import { measurePage } from "../performance/PageMetrics";

/** A real source whose entries were written by hand instead of by a browser. */
class ScriptedPerformanceSource implements PerformanceSource {
  constructor(
    private readonly resourceEntries: ResourceTiming[],
    private readonly navigationEntries: NavigationTiming[],
  ) {}

  resources(): readonly ResourceTiming[] {
    return this.resourceEntries;
  }

  navigations(): readonly NavigationTiming[] {
    return this.navigationEntries;
  }
}

/** A real sink that keeps what it is handed instead of posting it. */
class RecordingSink implements ObservationSink {
  readonly sent: PagePerformancePayload[] = [];

  send(payload: PagePerformancePayload): void {
    this.sent.push(payload);
  }
}

describe("MetricsCollector", () => {
  it("hands over every resource and navigation entry it was given", () => {
    // Arrange
    const source = new ScriptedPerformanceSource(
      [{ transferSize: 1_000 }, { transferSize: 2_000 }],
      [{ duration: 900 }],
    );
    const sink = new RecordingSink();

    // Act
    new MetricsCollector(source, sink).collect();

    // Assert
    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0][PerformanceEntryType.RESOURCE]).toHaveLength(2);
    expect(sink.sent[0][PerformanceEntryType.NAVIGATION]).toEqual([{ duration: 900 }]);
  });

  it("sends nothing until it is asked to collect", () => {
    // Arrange
    const sink = new RecordingSink();

    // Act
    new MetricsCollector(new ScriptedPerformanceSource([{ transferSize: 1 }], []), sink);

    // Assert
    expect(sink.sent).toHaveLength(0);
  });

  it("emits a payload the background can measure as-is", () => {
    // Arrange
    const sink = new RecordingSink();
    const source = new ScriptedPerformanceSource([{ transferSize: 4_096 }], [{ duration: 1_200 }]);

    // Act
    new MetricsCollector(source, sink).collect();

    // Assert — the wire shape and the reader agree, which is the whole point of
    // both sides importing PagePerformancePayload.
    expect(measurePage(sink.sent[0])).toEqual({
      valid: true,
      requests: 1,
      transferredBytes: 4_096,
      loadDurationMs: 1_200,
    });
  });

  it("forwards a page that reported no navigation entry", () => {
    // Arrange
    const sink = new RecordingSink();

    // Act
    new MetricsCollector(new ScriptedPerformanceSource([{ transferSize: 10 }], []), sink).collect();

    // Assert
    expect(sink.sent[0][PerformanceEntryType.NAVIGATION]).toEqual([]);
  });
});
