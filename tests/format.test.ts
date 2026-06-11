import { describe, it, expect } from 'vitest';
import { fmtMoney, fmtPct, fmtNum } from '@/lib/format';

describe('format', () => {
  it('formats dollar magnitudes', () => {
    expect(fmtMoney(2_140_000_000)).toBe('$2.14B');
    expect(fmtMoney(-310_000_000)).toBe('-$310M');
    expect(fmtMoney(52_300)).toBe('$52.3K');
    expect(fmtMoney(12.5)).toBe('$12.50');
  });
  it('formats percents with sign', () => {
    expect(fmtPct(1.234)).toBe('+1.23%');
    expect(fmtPct(-0.5)).toBe('-0.50%');
  });
  it('formats large numbers', () => {
    expect(fmtNum(1_532_000)).toBe('1.53M');
    expect(fmtNum(950)).toBe('950');
  });
});
