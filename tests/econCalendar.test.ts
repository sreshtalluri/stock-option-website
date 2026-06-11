import { describe, it, expect } from 'vitest';
import { mapFfEvents, mergeFomc, FOMC_2026 } from '@/lib/providers/econCalendar';

const raw = [
  { title: 'CPI m/m', country: 'USD', date: '2026-06-10T08:30:00-04:00', impact: 'High', forecast: '0.2%', previous: '0.3%' },
  { title: 'German ZEW', country: 'EUR', date: '2026-06-10T05:00:00-04:00', impact: 'Medium', forecast: '', previous: '' },
  { title: 'Crude Oil Inventories', country: 'USD', date: '2026-06-10T10:30:00-04:00', impact: 'Medium', forecast: '', previous: '1.2M' },
  { title: 'Federal Funds Rate', country: 'USD', date: '2026-06-17T14:00:00-04:00', impact: 'High', forecast: '4.00%', previous: '4.00%' },
];

describe('mapFfEvents', () => {
  it('keeps USD events only and normalizes impact', () => {
    const out = mapFfEvents(raw);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ title: 'CPI m/m', impact: 'high', forecast: '0.2%', source: 'feed' });
    expect(out[1].impact).toBe('medium');
  });
});

describe('mergeFomc', () => {
  it('adds upcoming FOMC dates within the horizon', () => {
    const out = mergeFomc([], new Date('2026-06-10T12:00:00Z'), 45);
    expect(out.some(e => e.date.startsWith('2026-06-17') && e.source === 'fomc-schedule')).toBe(true);
    expect(out.some(e => e.date.startsWith('2026-09-16'))).toBe(false); // beyond 45d
  });
  it('does not duplicate FOMC when the feed already has a rate decision that day', () => {
    const feed = mapFfEvents(raw); // includes Federal Funds Rate on 06-17
    const out = mergeFomc(feed, new Date('2026-06-10T12:00:00Z'), 45);
    const sameDay = out.filter(e => e.date.startsWith('2026-06-17'));
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0].source).toBe('feed');
  });
  it('drops past FOMC dates', () => {
    const out = mergeFomc([], new Date('2026-06-10T12:00:00Z'), 45);
    expect(out.some(e => e.date.startsWith('2026-04-29'))).toBe(false);
  });
});

describe('FOMC_2026', () => {
  it('has 8 scheduled decision dates', () => {
    expect(FOMC_2026).toHaveLength(8);
  });
});
