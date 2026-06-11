import { describe, it, expect } from 'vitest';
import { isMarketOpen } from '@/lib/marketHours';

describe('isMarketOpen', () => {
  it('open mid-day Wednesday', () => {
    expect(isMarketOpen(new Date('2026-06-10T15:00:00Z'))).toBe(true); // 11:00 ET Wed
  });
  it('closed pre-market', () => {
    expect(isMarketOpen(new Date('2026-06-10T12:00:00Z'))).toBe(false); // 8:00 ET
  });
  it('closed after 4pm ET', () => {
    expect(isMarketOpen(new Date('2026-06-10T20:30:00Z'))).toBe(false); // 16:30 ET
  });
  it('closed weekend', () => {
    expect(isMarketOpen(new Date('2026-06-13T15:00:00Z'))).toBe(false); // Saturday
  });
});
