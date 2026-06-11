import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearCache } from '@/lib/cache';

vi.mock('@/lib/providers/yahoo', () => ({
  getQuotes: vi.fn().mockResolvedValue([{ symbol: 'SPY', price: 600, change: 1, changePct: 0.2 }]),
}));

import { GET } from '@/app/api/quotes/route';
import { NextRequest } from 'next/server';

describe('GET /api/quotes', () => {
  beforeEach(() => clearCache());
  it('returns Cached envelope', async () => {
    const res = await GET(new NextRequest('http://localhost/api/quotes?symbols=spy'));
    const body = await res.json();
    expect(body.value[0].symbol).toBe('SPY');
    expect(body).toHaveProperty('asOf');
    expect(body.stale).toBe(false);
  });
  it('400s without symbols', async () => {
    const res = await GET(new NextRequest('http://localhost/api/quotes'));
    expect(res.status).toBe(400);
  });
});
