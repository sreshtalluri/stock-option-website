import { describe, it, expect } from 'vitest';
import { mapQuote, dedupeNews } from '@/lib/providers/yahoo';

describe('mapQuote', () => {
  it('maps yahoo quote fields', () => {
    const q = mapQuote({ symbol: 'SPY', shortName: 'SPDR S&P 500', regularMarketPrice: 600.5, regularMarketChange: 2.5, regularMarketChangePercent: 0.42, regularMarketDayHigh: 602, regularMarketDayLow: 598, regularMarketVolume: 1000, marketState: 'REGULAR' });
    expect(q).toEqual({ symbol: 'SPY', name: 'SPDR S&P 500', price: 600.5, change: 2.5, changePct: 0.42, dayHigh: 602, dayLow: 598, volume: 1000, marketState: 'REGULAR' });
  });
  it('defaults missing numerics to 0', () => {
    expect(mapQuote({ symbol: 'X' }).price).toBe(0);
  });
});

describe('dedupeNews', () => {
  it('dedupes by id and sorts newest first', () => {
    const items = [
      { id: 'a', title: 'A', source: 's', url: 'u', publishedAt: '2026-06-10T10:00:00Z' },
      { id: 'a', title: 'A dup', source: 's', url: 'u', publishedAt: '2026-06-10T10:00:00Z' },
      { id: 'b', title: 'B', source: 's', url: 'u', publishedAt: '2026-06-10T12:00:00Z' },
    ];
    const out = dedupeNews(items);
    expect(out.map(n => n.id)).toEqual(['b', 'a']);
  });
});
