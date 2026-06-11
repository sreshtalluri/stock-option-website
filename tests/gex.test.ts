import { describe, it, expect } from 'vitest';
import { computeGex } from '@/lib/gex/compute';
import type { OptionsChain } from '@/lib/types';

const NOW = new Date('2026-06-10T12:00:00Z');
const chain: OptionsChain = {
  symbol: 'TEST', spot: 100, asOf: '2026-06-10',
  contracts: [
    { type: 'call', strike: 105, expiry: '2026-06-19', gamma: 0.02, iv: 0.2, openInterest: 1000, volume: 100 }, // +200,000
    { type: 'put',  strike: 95,  expiry: '2026-06-19', gamma: 0.015, iv: 0.25, openInterest: 2000, volume: 600 }, // -300,000
    { type: 'call', strike: 100, expiry: '2026-06-19', gamma: 0.03, iv: 0.2, openInterest: 500, volume: 50 },   // +150,000
    { type: 'call', strike: 130, expiry: '2026-06-19', gamma: 0.001, iv: 0.4, openInterest: 99999, volume: 0 }, // outside ±15%
    { type: 'call', strike: 100, expiry: '2027-01-15', gamma: 0.01, iv: 0.2, openInterest: 99999, volume: 0 },  // > 60 DTE
    { type: 'call', strike: 101, expiry: '2026-06-19', gamma: 0.05, iv: 0.2, openInterest: 0, volume: 10 },     // zero OI
  ],
};

describe('computeGex', () => {
  const p = computeGex(chain, { now: NOW });

  it('computes per-strike net GEX with put sign negative, applying filters', () => {
    expect(p.byStrike.map(s => s.strike)).toEqual([95, 100, 105]);
    expect(p.byStrike[0].netGex).toBeCloseTo(-300_000);
    expect(p.byStrike[1].netGex).toBeCloseTo(150_000);
    expect(p.byStrike[2].netGex).toBeCloseTo(200_000);
  });

  it('computes total net GEX', () => {
    expect(p.totalGex).toBeCloseTo(50_000);
  });

  it('interpolates the zero-gamma flip point', () => {
    // cumulative: 95 -> -300k, 100 -> -150k, 105 -> +50k; crosses 0 at 100 + (150/200)*5
    expect(p.flipPoint).toBeCloseTo(103.75);
  });

  it('finds call and put walls', () => {
    expect(p.callWall).toBe(105);
    expect(p.putWall).toBe(95);
  });

  it('builds the strike x expiry heatmap', () => {
    expect(p.heatmap.expiries).toEqual(['2026-06-19']);
    expect(p.heatmap.strikes).toEqual([95, 100, 105]);
    expect(p.heatmap.values[0][0]).toBeCloseTo(-300_000);
    expect(p.heatmap.values[0][2]).toBeCloseTo(200_000);
  });

  it('returns null flip when cumulative never crosses zero', () => {
    const allCalls: OptionsChain = { ...chain, contracts: chain.contracts.filter(c => c.type === 'call') };
    expect(computeGex(allCalls, { now: NOW }).flipPoint).toBeNull();
  });
});
