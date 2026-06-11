import { describe, it, expect } from 'vitest';
import { gammaRegime, wallProximity, vixContext, earningsProximity, unusualActivity } from '@/lib/insights/rules';
import type { GexProfile, OptionsChain } from '@/lib/types';

const profile: GexProfile = {
  symbol: 'SPY', spot: 600, asOf: '', totalGex: 2_000_000_000, flipPoint: 595,
  callWall: 605, putWall: 580, byStrike: [], heatmap: { expiries: [], strikes: [], values: [] },
};

describe('gammaRegime', () => {
  it('positive GEX above flip -> pinned regime info', () => {
    const i = gammaRegime(profile);
    expect(i.severity).toBe('info');
    expect(i.body).toContain('595');
    expect(i.title.toLowerCase()).toContain('positive');
  });
  it('negative GEX -> volatile regime watch', () => {
    const i = gammaRegime({ ...profile, totalGex: -1_500_000_000 });
    expect(i.severity).toBe('watch');
    expect(i.title.toLowerCase()).toContain('negative');
  });
});

describe('wallProximity', () => {
  it('fires when spot within 1% of call wall', () => {
    const i = wallProximity({ ...profile, spot: 604 });
    expect(i?.body).toContain('605');
  });
  it('silent when far from both walls', () => {
    expect(wallProximity({ ...profile, spot: 593 })).toBeNull();
  });
});

describe('vixContext', () => {
  it('classifies bands', () => {
    expect(vixContext(12).title).toContain('Low');
    expect(vixContext(17).title).toContain('Normal');
    expect(vixContext(24).title).toContain('Elevated');
    expect(vixContext(33).severity).toBe('alert');
  });
});

describe('earningsProximity', () => {
  it('warns within 7 days', () => {
    const i = earningsProximity('NVDA', '2026-06-15', new Date('2026-06-10'));
    expect(i?.severity).toBe('watch');
    expect(i?.body).toContain('NVDA');
  });
  it('silent beyond 7 days', () => {
    expect(earningsProximity('NVDA', '2026-08-20', new Date('2026-06-10'))).toBeNull();
  });
});

describe('unusualActivity', () => {
  const chain: OptionsChain = {
    symbol: 'NVDA', spot: 100, asOf: '',
    contracts: [
      { type: 'call', strike: 110, expiry: '2026-06-19', gamma: 0.01, iv: 0.5, openInterest: 200, volume: 900 }, // ratio 4.5
      { type: 'put', strike: 90, expiry: '2026-06-19', gamma: 0.01, iv: 0.5, openInterest: 5000, volume: 100 },  // quiet
    ],
  };
  it('flags volume/OI outliers', () => {
    const list = unusualActivity(chain);
    expect(list).toHaveLength(1);
    expect(list[0].body).toContain('110');
  });
});
