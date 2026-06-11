type Entry<T> = { value: T; asOf: number; expires: number };
const store = new Map<string, Entry<unknown>>();

export interface Cached<T> { value: T; asOf: number; stale: boolean }

export async function getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<Cached<T>> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && hit.expires > now) return { value: hit.value, asOf: hit.asOf, stale: false };
  try {
    const value = await fetcher();
    store.set(key, { value, asOf: now, expires: now + ttlMs });
    return { value, asOf: now, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, asOf: hit.asOf, stale: true };
    throw err;
  }
}

export function clearCache() { store.clear(); }
