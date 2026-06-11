import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrFetch, clearCache } from '@/lib/cache';

describe('getOrFetch', () => {
  beforeEach(() => clearCache());

  it('fetches and caches within TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue(42);
    const a = await getOrFetch('k', 1000, fetcher);
    const b = await getOrFetch('k', 1000, fetcher);
    expect(a.value).toBe(42);
    expect(b.value).toBe(42);
    expect(b.stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expiry', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await getOrFetch('k', 1000, fetcher);
    vi.advanceTimersByTime(1500);
    const b = await getOrFetch('k', 1000, fetcher);
    expect(b.value).toBe(2);
    vi.useRealTimers();
  });

  it('serves stale value when fetcher fails', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(7).mockRejectedValueOnce(new Error('down'));
    await getOrFetch('k', 1000, fetcher);
    vi.advanceTimersByTime(1500);
    const b = await getOrFetch('k', 1000, fetcher);
    expect(b.value).toBe(7);
    expect(b.stale).toBe(true);
    vi.useRealTimers();
  });

  it('throws when fetcher fails and no cache exists', async () => {
    await expect(getOrFetch('nope', 1000, () => Promise.reject(new Error('down')))).rejects.toThrow('down');
  });
});
