const DISCOVER_KEY = "aimatex_music_search_history_discover";
const LIBRARY_KEY = "aimatex_music_search_history_library";
const MAX_ITEMS = 12;

export type SearchHistoryScope = "discover" | "library";

function storageKey(scope: SearchHistoryScope): string {
  return scope === "discover" ? DISCOVER_KEY : LIBRARY_KEY;
}

export function readSearchHistory(scope: SearchHistoryScope): string[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length >= 1)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function pushSearchHistory(scope: SearchHistoryScope, query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return readSearchHistory(scope);
  const prev = readSearchHistory(scope).filter((x) => x.toLowerCase() !== q.toLowerCase());
  const next = [q, ...prev].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function removeSearchHistoryItem(scope: SearchHistoryScope, query: string): string[] {
  const q = query.trim().toLowerCase();
  const next = readSearchHistory(scope).filter((x) => x.toLowerCase() !== q);
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearSearchHistory(scope: SearchHistoryScope): void {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}
