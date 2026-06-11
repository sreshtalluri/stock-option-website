import { describe, it, expect } from 'vitest';
import { parseOptionSymbol, normalizeChain, cboeUrlSymbol } from '@/lib/providers/cboe';
import fixture from './fixtures/cboe-sample.json';

describe('parseOptionSymbol', () => {
  it('parses calls', () => {
    expect(parseOptionSymbol('SPY260619C00610000')).toEqual({ type: 'call', strike: 610, expiry: '2026-06-19' });
  });
  it('parses puts with fractional strikes', () => {
    expect(parseOptionSymbol('SPY260619P00590500')).toEqual({ type: 'put', strike: 590.5, expiry: '2026-06-19' });
  });
  it('returns null for junk', () => {
    expect(parseOptionSymbol('BADSYMBOL')).toBeNull();
  });
});

describe('normalizeChain', () => {
  it('normalizes contracts and skips unparseable rows', () => {
    const chain = normalizeChain('SPY', fixture);
    expect(chain.symbol).toBe('SPY');
    expect(chain.spot).toBe(600);
    expect(chain.contracts).toHaveLength(5); // BADSYMBOL dropped
    const call610 = chain.contracts.find(c => c.strike === 610)!;
    expect(call610).toMatchObject({ type: 'call', gamma: 0.02, openInterest: 1000, expiry: '2026-06-19' });
  });
});

describe('cboeUrlSymbol', () => {
  it('prefixes underscore for indexes', () => {
    expect(cboeUrlSymbol('SPX')).toBe('_SPX');
    expect(cboeUrlSymbol('SPY')).toBe('SPY');
  });
});
