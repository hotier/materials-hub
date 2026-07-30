const CACHE_VERSION = '1';
const PREFIX = `material-hub-v${CACHE_VERSION}`;

export function useStorage() {
  function get<T = unknown>(key: string, fallback?: T): T | undefined {
    try {
      const raw = window.localStorage.getItem(`${PREFIX}:${key}`);
      if (raw === null) return fallback;
      const item = JSON.parse(raw);
      return item.value as T;
    } catch {
      return fallback;
    }
  }

  function set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(
        `${PREFIX}:${key}`,
        JSON.stringify({ value, ts: Date.now() })
      );
    } catch {}
  }

  function remove(key: string): void {
    window.localStorage.removeItem(`${PREFIX}:${key}`);
  }

  return { get, set, remove };
}
