/**
 * Single home for the `chrome.storage.local` keys.
 *
 * `SESSIONS` holds daily records, not browsing sessions. The key keeps its
 * historical name so an installed extension does not lose its data; the
 * mismatch is documented in docs/glossary.md rather than left to be rediscovered.
 */
export enum StorageKey {
  SESSIONS = "sessions",
  PREFERENCES = "preferences",
}
