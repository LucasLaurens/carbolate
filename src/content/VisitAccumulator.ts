import type { NavigationTiming, PageMeasurement, ResourceTiming } from "../performance/PageMetrics";
import {
  addResourceTiming,
  createEmptyMeasurement,
  withLoadDuration,
} from "../performance/PageMetrics";

/**
 * What one page visit has measured so far, kept in the page itself.
 *
 * It lives here rather than in the background because the background is a
 * service worker Chromium kills after 30 seconds of inactivity: a timer or a
 * running total held there is lost at a moment nobody chooses. This object lives
 * exactly as long as the thing it measures.
 *
 * No DOM, no globals — the wiring in `content/index.ts` turns browser events
 * into calls on it, and every rule below is assertable without a browser.
 * See docs/decisions/2026-09-15-enregistrement-vivant.md
 */
export class VisitAccumulator {
  private measurement: PageMeasurement = createEmptyMeasurement();
  private accumulatedVisibleMs = 0;
  private visible: boolean;
  private lastVisibilityChangeMs: number;

  constructor(startedVisible: boolean, startedAtMs: number) {
    this.visible = startedVisible;
    this.lastVisibilityChangeMs = startedAtMs;
  }

  /** O(1) — one entry, folded the moment it exists. */
  addResource(timing: ResourceTiming): void {
    this.measurement = addResourceTiming(this.measurement, timing);
  }

  recordNavigation(navigation: NavigationTiming | undefined): void {
    this.measurement = withLoadDuration(this.measurement, navigation);
  }

  /**
   * Repeated calls in the same state are ignored: `visibilitychange` fires on
   * both edges and `pageshow` can arrive on a tab that never went away, so a
   * second "visible" must not restart a window that is already open.
   */
  markVisible(atMs: number): void {
    if (this.visible) return;
    this.visible = true;
    this.lastVisibilityChangeMs = atMs;
  }

  markHidden(atMs: number): void {
    if (!this.visible) return;
    this.accumulatedVisibleMs += atMs - this.lastVisibilityChangeMs;
    this.visible = false;
    this.lastVisibilityChangeMs = atMs;
  }

  /**
   * The cumulative totals, including the window still open. Reading closes
   * nothing: the next read of a visible page reports a longer time, which is
   * what makes a flush safe to repeat.
   *
   * O(1) time and space.
   */
  readMeasurement(atMs: number): PageMeasurement {
    const openWindowMs = this.visible ? atMs - this.lastVisibilityChangeMs : 0;
    return { ...this.measurement, visibleDurationMs: this.accumulatedVisibleMs + openWindowMs };
  }
}
