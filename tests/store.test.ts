import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-'));
  process.env.GAMMADESK_DATA_DIR = dir;
});

describe('watchlist store', () => {
  it('seeds defaults on first read', async () => {
    const { readWatchlist } = await import('@/lib/store');
    expect(readWatchlist()).toEqual(['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL']);
  });
  it('adds and removes symbols, uppercased and deduped', async () => {
    const { readWatchlist, addSymbol, removeSymbol } = await import('@/lib/store');
    addSymbol('amd');
    addSymbol('AMD');
    expect(readWatchlist()).toContain('AMD');
    expect(readWatchlist().filter(s => s === 'AMD')).toHaveLength(1);
    removeSymbol('AMD');
    expect(readWatchlist()).not.toContain('AMD');
  });
});

describe('gex snapshots', () => {
  it('appends and reads per-symbol, pruning entries older than 7 days', async () => {
    const { appendSnapshot, readSnapshots } = await import('@/lib/gex/snapshots');
    const now = Date.now();
    appendSnapshot({ ts: now - 10 * 86_400_000, symbol: 'SPY', totalGex: 1, flip: null, spot: 1 });
    appendSnapshot({ ts: now, symbol: 'SPY', totalGex: 2e9, flip: 595, spot: 600 });
    appendSnapshot({ ts: now, symbol: 'QQQ', totalGex: 1e9, flip: null, spot: 530 });
    const spy = readSnapshots('SPY');
    expect(spy).toHaveLength(1);
    expect(spy[0].totalGex).toBe(2e9);
  });
});
