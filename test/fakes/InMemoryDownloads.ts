/**
 * A real `chrome.downloads` that files the request instead of writing to disk.
 *
 * Concrete, not configurable: the failure case is a second class rather than a
 * flag, so a test that wants a refused download says so by construction.
 */
export type DownloadRequest = { url: string; filename: string };

export class InMemoryDownloads {
  readonly requested: DownloadRequest[] = [];

  download(options: DownloadRequest, callback: (downloadId: number | undefined) => void): void {
    this.requested.push(options);
    callback(this.requested.length);
  }
}

/** The browser refusing the download: no id, and a message on `runtime.lastError`. */
export class RefusingDownloads {
  constructor(private readonly message: string) {}

  download(_options: DownloadRequest, callback: (downloadId: number | undefined) => void): void {
    (
      globalThis as unknown as { chrome: { runtime: { lastError?: { message: string } } } }
    ).chrome.runtime.lastError = { message: this.message };
    callback(undefined);
  }
}
