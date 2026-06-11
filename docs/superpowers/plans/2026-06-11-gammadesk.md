# GammaDesk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-first Next.js trading dashboard with live market trends, self-computed GEX (profile + heatmap + key levels), ticker search with news/ratings/stats, and plain-English insights.

**Architecture:** Single Next.js (App Router) app. API routes wrap free providers (CBOE delayed options, Yahoo Finance, optional Finnhub) behind a TTL cache that falls back to stale data on upstream failure. Pure-function GEX and insights engines are unit-tested with Vitest. Client panels poll API routes with a small `usePolling` hook; charts are TradingView embeds (realtime via the user's Premium login) plus hand-rolled SVG/div visualizations for GEX.

**Tech Stack:** Next.js 15 + TypeScript + Tailwind v4, `yahoo-finance2`, Vitest. No database — JSON files under `data/`.

**Spec:** `docs/superpowers/specs/2026-06-11-trading-dashboard-design.md`

---

## File structure

```
src/
  app/
    layout.tsx, page.tsx, globals.css        # shell + theme
    api/quotes/route.ts                      # GET ?symbols=A,B
    api/search/route.ts                      # GET ?q=
    api/movers/route.ts
    api/sectors/route.ts
    api/news/route.ts                        # GET ?symbols= (optional)
    api/ratings/[symbol]/route.ts
    api/stats/[symbol]/route.ts
    api/earnings/route.ts                    # watchlist upcoming earnings
    api/insights/route.ts                    # market-level insight cards
    api/gex/[symbol]/route.ts                # profile + per-symbol insights
    api/gex/[symbol]/history/route.ts        # intraday snapshots
    api/watchlist/route.ts                   # GET/POST/DELETE
  lib/
    types.ts          # shared domain types
    cache.ts          # TTL cache w/ stale fallback
    format.ts         # number/money/pct formatting
    marketHours.ts    # US market-hours check (ET)
    store.ts          # watchlist JSON persistence
    providers/cboe.ts # options chains (+symbol parser)
    providers/yahoo.ts# quotes/search/movers/sectors/news/ratings/stats
    providers/finnhub.ts # optional news
    gex/compute.ts    # GEX math (pure)
    gex/snapshots.ts  # totalGex history JSON persistence
    insights/rules.ts # rule-based insight generators (pure)
    insights/glossary.ts # metric explainers
  hooks/usePolling.ts
  components/
    ui.tsx            # Panel, StaleBadge, PriceChange, InfoTip (small shared bits)
    TopStrip.tsx, TickerSearch.tsx, WatchlistBar.tsx, RightRail.tsx
    TradingViewChart.tsx
    views/MarketView.tsx, views/GexView.tsx, views/TickerView.tsx
    gex/GexProfile.tsx, gex/GexHeatmap.tsx, gex/LevelsTable.tsx, gex/GexSparkline.tsx
tests/  (vitest; fixtures in tests/fixtures/)
```

Conventions: all API routes return `{ value, asOf, stale }` (the `Cached<T>` shape). All client components poll via `usePolling`. Tests import via `@/` alias.

---

### Task 1: Scaffold app + tooling

**Files:** Create: Next.js scaffold, `vitest.config.ts`, `.env.example`; Modify: `package.json`, `.gitignore`, `src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js into the repo root**

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
Expected: scaffold completes (existing `docs/` and `.gitignore` are untouched or merged; verify `.gitignore` still ignores `.superpowers/`, `data/`, `.env.local` — re-add if clobbered).

- [ ] **Step 2: Install deps**

```bash
npm i yahoo-finance2 && npm i -D vitest
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 4: Add test script to `package.json`** — `"test": "vitest run"`.

- [ ] **Step 5: Create `.env.example`**

```
# Optional: richer news via Finnhub (free key at finnhub.io). App works without it.
FINNHUB_API_KEY=
```

- [ ] **Step 6: Replace `src/app/globals.css` with the theme**

```css
@import "tailwindcss";

@theme {
  --color-bg: #0a0e14;
  --color-panel: #10151d;
  --color-panel2: #161d27;
  --color-border: #1e2735;
  --color-text: #e6edf3;
  --color-muted: #8b949e;
  --color-up: #3fb950;
  --color-down: #f85149;
  --color-accent: #58a6ff;
  --color-warn: #d29922;
}

html, body { height: 100%; }
body { background: var(--color-bg); color: var(--color-text); }
.tabular { font-variant-numeric: tabular-nums; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
```

- [ ] **Step 7: Verify build + commit**

```bash
npm run build && git add -A && git commit -m "chore: scaffold Next.js app with Tailwind, Vitest, theme tokens"
```
Expected: build passes.

---

### Task 2: Domain types + TTL cache

**Files:** Create: `src/lib/types.ts`, `src/lib/cache.ts`, `tests/cache.test.ts`

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export interface QuoteLite {
  symbol: string; name?: string; price: number; change: number; changePct: number;
  dayHigh?: number; dayLow?: number; volume?: number; marketState?: string;
}
export interface OptionContract {
  type: 'call' | 'put'; strike: number; expiry: string; // YYYY-MM-DD
  gamma: number; iv: number; openInterest: number; volume: number;
}
export interface OptionsChain { symbol: string; spot: number; asOf: string; contracts: OptionContract[]; }
export interface GexByStrike { strike: number; netGex: number; callGex: number; putGex: number; }
export interface GexProfile {
  symbol: string; spot: number; asOf: string; totalGex: number;
  flipPoint: number | null; callWall: number | null; putWall: number | null;
  byStrike: GexByStrike[];
  heatmap: { expiries: string[]; strikes: number[]; values: number[][] }; // values[expiryIdx][strikeIdx]
}
export interface NewsItem { id: string; title: string; source: string; url: string; publishedAt: string; symbols?: string[]; }
export interface Insight { id: string; severity: 'info' | 'watch' | 'alert'; title: string; body: string; metric?: string; }
export interface GexSnapshot { ts: number; symbol: string; totalGex: number; flip: number | null; spot: number; }
```

- [ ] **Step 2: Write failing tests `tests/cache.test.ts`**

```ts
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
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/cache.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/cache.ts`**

```ts
type Entry<T> = { value: T; asOf: number; expires: number };
const store = new Map<string, Entry<unknown>>();

export interface Cached<T> { value: T; asOf: number; stale: boolean }

export async function getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<Cached<T>> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && hit.expires > now) return { value: hit.value, asOf: hit.asOf, stale: false };
  try {
    const value = await fetcher();
    store.set(key, { value, asOf: now, expires: now + ttlMs });
    return { value, asOf: now, stale: false };
  } catch (err) {
    if (hit) return { value: hit.value, asOf: hit.asOf, stale: true };
    throw err;
  }
}

export function clearCache() { store.clear(); }
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/cache.test.ts` → PASS (4 tests).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: domain types and TTL cache with stale fallback"`

---

### Task 3: Formatting + market hours utils

**Files:** Create: `src/lib/format.ts`, `src/lib/marketHours.ts`, `tests/format.test.ts`, `tests/marketHours.test.ts`

- [ ] **Step 1: Write failing tests `tests/format.test.ts`**

```ts
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
```

- [ ] **Step 2: Write failing tests `tests/marketHours.test.ts`** (fixed UTC instants; ET = UTC-4 in June)

```ts
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
```

- [ ] **Step 3: Run both** — `npx vitest run tests/format.test.ts tests/marketHours.test.ts` → FAIL.

- [ ] **Step 4: Implement `src/lib/format.ts`**

```ts
export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${trim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3)}K`;
  return `${sign}$${a.toFixed(2)}`;
}
export function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}%`;
}
export function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${trim(v / 1e9)}B`;
  if (a >= 1e6) return `${trim(v / 1e6)}M`;
  if (a >= 1e3) return `${trim(v / 1e3)}K`;
  return String(v);
}
function trim(n: number): string {
  const s = n.toFixed(2);
  return s.endsWith('0') ? s.slice(0, -1) : s; // 2.14 -> "2.14", 310.00 -> "310.0"? see below
}
```
**Note:** `trim` must produce `2.14B`, `310M`, `52.3K` for the test values: implement as
```ts
function trim(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}
```
(`310.00 -> "310"`, `52.30 -> "52.3"`, `2.14 -> "2.14"`, `1.53 -> "1.53"`.) Use this version.

- [ ] **Step 5: Implement `src/lib/marketHours.ts`**

```ts
export function isMarketOpen(d: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const minutes = parseInt(get('hour'), 10) % 24 * 60 + parseInt(get('minute'), 10);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60; // 9:30–16:00 ET; holidays not modeled (documented)
}
```

- [ ] **Step 6: Run tests** — `npx vitest run tests/format.test.ts tests/marketHours.test.ts` → PASS.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: formatting and market-hours utilities"`

---

### Task 4: CBOE options provider

**Files:** Create: `src/lib/providers/cboe.ts`, `tests/cboe.test.ts`, `tests/fixtures/cboe-sample.json`

- [ ] **Step 1: Create fixture `tests/fixtures/cboe-sample.json`** (shape mirrors CBOE delayed-quotes payload)

```json
{
  "data": {
    "symbol": "SPY",
    "current_price": 600.0,
    "options": [
      { "option": "SPY260619C00610000", "gamma": 0.02, "iv": 0.18, "open_interest": 1000, "volume": 200, "bid": 1.0, "ask": 1.2 },
      { "option": "SPY260619P00590000", "gamma": 0.015, "iv": 0.22, "open_interest": 2000, "volume": 500, "bid": 0.8, "ask": 0.9 },
      { "option": "SPY260619C00600000", "gamma": 0.03, "iv": 0.19, "open_interest": 500, "volume": 100, "bid": 2.0, "ask": 2.2 },
      { "option": "SPY270115C00600000", "gamma": 0.01, "iv": 0.2, "open_interest": 900, "volume": 10, "bid": 5.0, "ask": 5.5 },
      { "option": "SPY260619C00900000", "gamma": 0.001, "iv": 0.4, "open_interest": 50, "volume": 0, "bid": 0.01, "ask": 0.02 },
      { "option": "BADSYMBOL", "gamma": 0.01, "iv": 0.2, "open_interest": 10, "volume": 0, "bid": 0, "ask": 0 }
    ]
  },
  "timestamp": "2026-06-10 15:45:00"
}
```

- [ ] **Step 2: Write failing tests `tests/cboe.test.ts`**

```ts
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
```

- [ ] **Step 3: Run** — `npx vitest run tests/cboe.test.ts` → FAIL.

- [ ] **Step 4: Implement `src/lib/providers/cboe.ts`**

```ts
import type { OptionContract, OptionsChain } from '@/lib/types';

const OPTION_RE = /^[A-Z.]{1,6}(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;
const INDEX_SYMBOLS = new Set(['SPX', 'XSP', 'NDX', 'RUT', 'VIX', 'DJX']);

export function parseOptionSymbol(s: string): Pick<OptionContract, 'type' | 'strike' | 'expiry'> | null {
  const m = s.replace(/\s+/g, '').match(OPTION_RE);
  if (!m) return null;
  const [, yy, mm, dd, cp, strikeRaw] = m;
  return {
    type: cp === 'C' ? 'call' : 'put',
    strike: parseInt(strikeRaw, 10) / 1000,
    expiry: `20${yy}-${mm}-${dd}`,
  };
}

export function cboeUrlSymbol(symbol: string): string {
  return INDEX_SYMBOLS.has(symbol.toUpperCase()) ? `_${symbol.toUpperCase()}` : symbol.toUpperCase();
}

interface CboeRawOption { option: string; gamma: number; iv: number; open_interest: number; volume: number; }
interface CboeRaw { data: { current_price?: number; close?: number; options: CboeRawOption[] }; timestamp?: string; }

export function normalizeChain(symbol: string, raw: CboeRaw): OptionsChain {
  const spot = raw.data.current_price ?? raw.data.close;
  if (!spot) throw new Error(`CBOE: no spot price for ${symbol}`);
  const contracts: OptionContract[] = [];
  for (const o of raw.data.options ?? []) {
    const parsed = parseOptionSymbol(o.option);
    if (!parsed) continue;
    contracts.push({ ...parsed, gamma: o.gamma ?? 0, iv: o.iv ?? 0, openInterest: o.open_interest ?? 0, volume: o.volume ?? 0 });
  }
  return { symbol, spot, asOf: raw.timestamp ?? new Date().toISOString(), contracts };
}

export async function fetchChain(symbol: string): Promise<OptionsChain> {
  const url = `https://cdn.cboe.com/api/global/delayed_quotes/options/${cboeUrlSymbol(symbol)}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`CBOE ${symbol}: HTTP ${res.status}`);
  return normalizeChain(symbol.toUpperCase(), (await res.json()) as CboeRaw);
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/cboe.test.ts` → PASS.

- [ ] **Step 6: Live smoke check (one-off)**

```bash
node -e "fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json',{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.json()).then(j=>console.log(j.data.current_price, j.data.options.length))"
```
Expected: prints a spot price and a large option count. If the shape differs from the fixture, update fixture + parser to match reality (the test is the contract).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: CBOE delayed-quotes options provider with symbol parser"`

---

### Task 5: GEX engine

**Files:** Create: `src/lib/gex/compute.ts`, `tests/gex.test.ts`

- [ ] **Step 1: Write failing tests `tests/gex.test.ts`** (hand-computed: GEX = gamma × OI × 100 × spot² × 0.01; spot=100 → per-unit 10,000)

```ts
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
```

- [ ] **Step 2: Run** — `npx vitest run tests/gex.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/gex/compute.ts`**

```ts
import type { GexByStrike, GexProfile, OptionsChain } from '@/lib/types';

const MULTIPLIER = 100;
const MOVE = 0.01; // dollar gamma per 1% move

export interface GexComputeOptions { strikeRangePct?: number; maxDte?: number; now?: Date; }

export function computeGex(chain: OptionsChain, opts: GexComputeOptions = {}): GexProfile {
  const { strikeRangePct = 0.15, maxDte = 60, now = new Date() } = opts;
  const { spot } = chain;
  const lo = spot * (1 - strikeRangePct), hi = spot * (1 + strikeRangePct);
  const maxMs = maxDte * 86_400_000;

  const eligible = chain.contracts.filter(c => {
    if (c.strike < lo || c.strike > hi) return false;
    if (c.openInterest <= 0 || c.gamma <= 0) return false;
    const dte = new Date(`${c.expiry}T16:00:00-05:00`).getTime() - now.getTime();
    return dte >= -86_400_000 && dte <= maxMs; // keep today's expiry
  });

  const perUnit = MULTIPLIER * spot * spot * MOVE;
  const byStrikeMap = new Map<number, GexByStrike>();
  const cellMap = new Map<string, number>(); // `${expiry}|${strike}` -> net

  for (const c of eligible) {
    const gex = c.gamma * c.openInterest * perUnit * (c.type === 'call' ? 1 : -1);
    const row = byStrikeMap.get(c.strike) ?? { strike: c.strike, netGex: 0, callGex: 0, putGex: 0 };
    row.netGex += gex;
    if (c.type === 'call') row.callGex += gex; else row.putGex += gex;
    byStrikeMap.set(c.strike, row);
    const key = `${c.expiry}|${c.strike}`;
    cellMap.set(key, (cellMap.get(key) ?? 0) + gex);
  }

  const byStrike = [...byStrikeMap.values()].sort((a, b) => a.strike - b.strike);
  const totalGex = byStrike.reduce((s, r) => s + r.netGex, 0);

  // flip: where cumulative net GEX (ascending strikes) crosses zero
  let flipPoint: number | null = null;
  let cum = 0, prevCum = 0;
  for (let i = 0; i < byStrike.length; i++) {
    prevCum = cum;
    cum += byStrike[i].netGex;
    if (i > 0 && prevCum < 0 && cum >= 0) {
      const a = byStrike[i - 1].strike, b = byStrike[i].strike;
      flipPoint = a + (0 - prevCum) / (cum - prevCum) * (b - a);
      break;
    }
  }

  const positive = byStrike.filter(r => r.netGex > 0);
  const negative = byStrike.filter(r => r.netGex < 0);
  const callWall = positive.length ? positive.reduce((m, r) => (r.netGex > m.netGex ? r : m)).strike : null;
  const putWall = negative.length ? negative.reduce((m, r) => (r.netGex < m.netGex ? r : m)).strike : null;

  const expiries = [...new Set(eligible.map(c => c.expiry))].sort();
  const strikes = byStrike.map(r => r.strike);
  const values = expiries.map(e => strikes.map(k => cellMap.get(`${e}|${k}`) ?? 0));

  return { symbol: chain.symbol, spot, asOf: chain.asOf, totalGex, flipPoint, callWall, putWall, byStrike, heatmap: { expiries, strikes, values } };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/gex.test.ts` → PASS (6 tests).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: GEX engine — profile, flip point, walls, heatmap"`

---

### Task 6: Insights rules + glossary

**Files:** Create: `src/lib/insights/rules.ts`, `src/lib/insights/glossary.ts`, `tests/insights.test.ts`

- [ ] **Step 1: Write failing tests `tests/insights.test.ts`**

```ts
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
```

- [ ] **Step 2: Run** — `npx vitest run tests/insights.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/insights/rules.ts`**

```ts
import type { GexProfile, Insight, OptionsChain } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

export function gammaRegime(p: GexProfile): Insight {
  const flip = p.flipPoint ? p.flipPoint.toFixed(0) : 'n/a';
  if (p.totalGex >= 0) {
    return {
      id: `regime-${p.symbol}`, severity: 'info', metric: 'gex',
      title: `${p.symbol}: Positive gamma — pinned, mean-reverting tape`,
      body: `Net GEX is ${fmtMoney(p.totalGex)}. Dealers are long gamma: they sell rallies and buy dips, which dampens moves. Expect chop/pinning while price holds above the flip point (${flip}). A break below ${flip} would flip dealers short gamma and open up bigger moves.`,
    };
  }
  return {
    id: `regime-${p.symbol}`, severity: 'watch', metric: 'gex',
    title: `${p.symbol}: Negative gamma — trend/volatility regime`,
    body: `Net GEX is ${fmtMoney(p.totalGex)}. Dealers are short gamma: hedging chases price (selling into drops, buying into rips), amplifying moves both ways. Expect wider ranges and faster trends until price reclaims the flip point (${flip}).`,
  };
}

export function wallProximity(p: GexProfile): Insight | null {
  const near = (level: number | null) => level !== null && Math.abs(p.spot - level) / p.spot < 0.01;
  if (near(p.callWall)) {
    return {
      id: `wall-${p.symbol}`, severity: 'watch', metric: 'callWall',
      title: `${p.symbol} near call wall ${p.callWall}`,
      body: `Spot ${p.spot.toFixed(2)} is within 1% of the call wall at ${p.callWall} — the strike with the most positive gamma. It often acts as a magnet intraday and resistance into expiry; upside tends to stall here unless the wall rolls higher.`,
    };
  }
  if (near(p.putWall)) {
    return {
      id: `wall-${p.symbol}`, severity: 'watch', metric: 'putWall',
      title: `${p.symbol} near put wall ${p.putWall}`,
      body: `Spot ${p.spot.toFixed(2)} is within 1% of the put wall at ${p.putWall} — the strike with the most negative gamma. It often acts as support, but a decisive break can accelerate selling as dealer hedging kicks in.`,
    };
  }
  return null;
}

export function vixContext(vix: number): Insight {
  const mk = (sev: Insight['severity'], band: string, body: string): Insight =>
    ({ id: 'vix', severity: sev, metric: 'vix', title: `VIX ${vix.toFixed(1)} — ${band} volatility`, body });
  if (vix < 14) return mk('info', 'Low', 'Options are cheap; long premium (debit) strategies are relatively attractive, but expect grindy, low-range days. Vol spikes from here can be sharp.');
  if (vix < 20) return mk('info', 'Normal', 'Volatility is in its normal band. No strong edge from vol itself — lean on levels and trend.');
  if (vix < 28) return mk('watch', 'Elevated', 'Premium is rich; selling spreads benefits, buying options needs bigger moves to profit. Size down — ranges are wide.');
  return mk('alert', 'Extreme', 'Stress conditions. Spreads are wide, moves are violent, and gamma regimes dominate. Trade small or stand aside.');
}

export function earningsProximity(symbol: string, earningsDate: string | null, now: Date = new Date()): Insight | null {
  if (!earningsDate) return null;
  const days = (new Date(earningsDate).getTime() - now.getTime()) / 86_400_000;
  if (days < -1 || days > 7) return null;
  return {
    id: `earnings-${symbol}`, severity: 'watch', metric: 'earnings',
    title: `${symbol} reports in ${Math.max(0, Math.round(days))} day(s)`,
    body: `${symbol} has earnings on ${earningsDate}. Implied volatility is likely inflated and will crush after the report — long options lose that premium even if direction is right. Day/swing entries around earnings are a different game; size accordingly.`,
  };
}

export function unusualActivity(chain: OptionsChain): Insight[] {
  return chain.contracts
    .filter(c => c.openInterest >= 100 && c.volume >= 500 && c.volume / c.openInterest >= 3)
    .sort((a, b) => b.volume / b.openInterest - a.volume / a.openInterest)
    .slice(0, 3)
    .map(c => ({
      id: `uoa-${chain.symbol}-${c.expiry}-${c.strike}-${c.type}`, severity: 'watch' as const, metric: 'volOi',
      title: `Unusual ${c.type} volume: ${chain.symbol} ${c.strike} ${c.expiry}`,
      body: `${c.volume.toLocaleString()} contracts traded vs ${c.openInterest.toLocaleString()} open interest (${(c.volume / c.openInterest).toFixed(1)}x). Heavy new positioning — someone is making a fresh bet at this strike.`,
    }));
}

export function sectorSkew(sectors: { name: string; changePct: number }[]): Insight | null {
  if (sectors.length < 2) return null;
  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  const spread = top.changePct - bottom.changePct;
  return {
    id: 'sector-skew', severity: spread > 2 ? 'watch' : 'info', metric: 'sectors',
    title: spread > 2 ? `Wide sector dispersion (${spread.toFixed(1)}pts)` : 'Sectors moving together',
    body: spread > 2
      ? `${top.name} (+${top.changePct.toFixed(2)}%) is leading while ${bottom.name} (${bottom.changePct.toFixed(2)}%) lags — rotation day. Index direction may be muted; single-name moves matter more.`
      : `Sector spread is narrow (${top.name} ${top.changePct.toFixed(2)}% to ${bottom.name} ${bottom.changePct.toFixed(2)}%). Broad, correlated tape — index trades dominate.`,
  };
}
```

- [ ] **Step 4: Implement `src/lib/insights/glossary.ts`**

```ts
export interface GlossaryEntry { term: string; short: string; why: string; }

export const GLOSSARY: Record<string, GlossaryEntry> = {
  gex: {
    term: 'Net GEX (Gamma Exposure)',
    short: 'Estimated dollar value of market-maker hedging per 1% move, summed across strikes. Calls count positive, puts negative (assumes dealers are long calls customers sold, short puts customers bought).',
    why: 'Positive = dealers stabilize price (chop/pinning). Negative = dealers amplify moves (trends, volatility). It tells you what kind of day to expect.',
  },
  flip: {
    term: 'Zero-Gamma Flip Point',
    short: 'The price where cumulative net GEX crosses zero — above it dealers are net long gamma, below it net short.',
    why: 'Crossing the flip changes market behavior: above = mean reversion, below = momentum. A key line for bias.',
  },
  callWall: {
    term: 'Call Wall',
    short: 'The strike with the largest positive gamma concentration.',
    why: 'Acts like a magnet/ceiling: dealer hedging supplies stock as price rises into it. Common profit-taking level for longs.',
  },
  putWall: {
    term: 'Put Wall',
    short: 'The strike with the largest negative gamma concentration.',
    why: 'Often acts as support — but if broken, hedging flows can accelerate the drop. A key risk level.',
  },
  iv: {
    term: 'Implied Volatility (IV)',
    short: 'The market\'s priced-in expectation of future movement, derived from option prices.',
    why: 'High IV = expensive options (favor selling/spreads); low IV = cheap options (favor buying). Compare to its own history, not an absolute number.',
  },
  oi: {
    term: 'Open Interest (OI)',
    short: 'Number of option contracts currently open at a strike.',
    why: 'Where OI clusters, hedging flows concentrate — these strikes become the walls and pins.',
  },
  vix: {
    term: 'VIX',
    short: 'The 30-day implied volatility index for the S&P 500.',
    why: '<14 calm, 14–20 normal, 20–28 elevated, 28+ stress. Sets the backdrop for position sizing and strategy choice.',
  },
  volOi: {
    term: 'Volume / OI Ratio',
    short: 'Today\'s contract volume divided by existing open interest.',
    why: '≥3x with real size usually means fresh positioning (not closing) — someone is placing a new bet worth noting.',
  },
  regime: {
    term: 'Gamma Regime',
    short: 'Shorthand for whether the market is in positive (pinned) or negative (volatile) net gamma.',
    why: 'The single most useful daily context: it sets expectations for range, chop, and follow-through.',
  },
};
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/insights.test.ts` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: rule-based insights engine and metric glossary"`

---

### Task 7: Yahoo + Finnhub providers

**Files:** Create: `src/lib/providers/yahoo.ts`, `src/lib/providers/finnhub.ts`, `tests/yahoo.test.ts`

- [ ] **Step 1: Write failing tests for the pure mappers `tests/yahoo.test.ts`**

```ts
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
```

- [ ] **Step 2: Run** — `npx vitest run tests/yahoo.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/providers/yahoo.ts`**

```ts
import yahooFinance from 'yahoo-finance2';
import type { NewsItem, QuoteLite } from '@/lib/types';

// yahoo-finance2 logs survey notices; silence if API available
try { (yahooFinance as unknown as { suppressNotices?: (n: string[]) => void }).suppressNotices?.(['yahooSurvey']); } catch { /* noop */ }

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapQuote(q: any): QuoteLite {
  return {
    symbol: q.symbol, name: q.shortName ?? q.longName,
    price: q.regularMarketPrice ?? 0, change: q.regularMarketChange ?? 0, changePct: q.regularMarketChangePercent ?? 0,
    dayHigh: q.regularMarketDayHigh, dayLow: q.regularMarketDayLow, volume: q.regularMarketVolume, marketState: q.marketState,
  };
}

export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const n of items) if (!seen.has(n.id)) seen.set(n.id, n);
  return [...seen.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getQuotes(symbols: string[]): Promise<QuoteLite[]> {
  const res = await yahooFinance.quote(symbols);
  return (Array.isArray(res) ? res : [res]).map(mapQuote);
}

export async function searchTickers(q: string): Promise<{ symbol: string; name: string; exch: string }[]> {
  const res: any = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });
  return (res.quotes ?? [])
    .filter((r: any) => r.symbol && (r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'INDEX'))
    .map((r: any) => ({ symbol: r.symbol, name: r.shortname ?? r.longname ?? r.symbol, exch: r.exchDisp ?? '' }));
}

export async function getMovers(): Promise<{ gainers: QuoteLite[]; losers: QuoteLite[]; actives: QuoteLite[] }> {
  const run = async (scrIds: string) => {
    const res: any = await yahooFinance.screener({ scrIds: scrIds as any, count: 8 });
    return (res.quotes ?? []).map(mapQuote);
  };
  const [gainers, losers, actives] = await Promise.all([run('day_gainers'), run('day_losers'), run('most_actives')]);
  return { gainers, losers, actives };
}

export const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology' }, { symbol: 'XLF', name: 'Financials' }, { symbol: 'XLV', name: 'Health Care' },
  { symbol: 'XLE', name: 'Energy' }, { symbol: 'XLY', name: 'Cons. Discretionary' }, { symbol: 'XLP', name: 'Cons. Staples' },
  { symbol: 'XLI', name: 'Industrials' }, { symbol: 'XLU', name: 'Utilities' }, { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' }, { symbol: 'XLC', name: 'Comm. Services' },
];

export async function getSectors(): Promise<{ symbol: string; name: string; changePct: number }[]> {
  const quotes = await getQuotes(SECTOR_ETFS.map(s => s.symbol));
  return SECTOR_ETFS.map(s => ({ ...s, changePct: quotes.find(q => q.symbol === s.symbol)?.changePct ?? 0 }));
}

export async function getYahooNews(symbols: string[]): Promise<NewsItem[]> {
  const lists = await Promise.all(symbols.map(async sym => {
    try {
      const res: any = await yahooFinance.search(sym, { quotesCount: 0, newsCount: 6 });
      return (res.news ?? []).map((n: any): NewsItem => ({
        id: n.uuid ?? n.link, title: n.title, source: n.publisher ?? 'Yahoo',
        url: n.link, publishedAt: new Date(n.providerPublishTime ?? Date.now()).toISOString(), symbols: [sym],
      }));
    } catch { return []; }
  }));
  return dedupeNews(lists.flat());
}

export async function getRatings(symbol: string) {
  const res: any = await yahooFinance.quoteSummary(symbol, {
    modules: ['recommendationTrend', 'upgradeDowngradeHistory', 'financialData'] as any,
  });
  const trend = res.recommendationTrend?.trend?.[0] ?? null;
  const history = (res.upgradeDowngradeHistory?.history ?? []).slice(0, 10).map((h: any) => ({
    firm: h.firm, action: h.action, fromGrade: h.fromGrade, toGrade: h.toGrade,
    date: h.epochGradeDate ? new Date(h.epochGradeDate).toISOString().slice(0, 10) : null,
  }));
  return {
    consensus: trend ? { strongBuy: trend.strongBuy, buy: trend.buy, hold: trend.hold, sell: trend.sell, strongSell: trend.strongSell } : null,
    meanRating: res.financialData?.recommendationMean ?? null,
    ratingKey: res.financialData?.recommendationKey ?? null,
    targetMean: res.financialData?.targetMeanPrice ?? null,
    targetHigh: res.financialData?.targetHighPrice ?? null,
    targetLow: res.financialData?.targetLowPrice ?? null,
    history,
  };
}

export async function getStats(symbol: string) {
  const res: any = await yahooFinance.quoteSummary(symbol, {
    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'calendarEvents'] as any,
  });
  const earnings = res.calendarEvents?.earnings?.earningsDate?.[0] ?? null;
  return {
    symbol, name: res.price?.shortName ?? symbol,
    marketCap: res.price?.marketCap ?? res.summaryDetail?.marketCap ?? null,
    peRatio: res.summaryDetail?.trailingPE ?? null,
    forwardPe: res.summaryDetail?.forwardPE ?? null,
    week52High: res.summaryDetail?.fiftyTwoWeekHigh ?? null,
    week52Low: res.summaryDetail?.fiftyTwoWeekLow ?? null,
    avgVolume: res.summaryDetail?.averageVolume ?? null,
    beta: res.summaryDetail?.beta ?? null,
    shortPctFloat: res.defaultKeyStatistics?.shortPercentOfFloat ?? null,
    earningsDate: earnings ? new Date(earnings).toISOString().slice(0, 10) : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
```

- [ ] **Step 4: Implement `src/lib/providers/finnhub.ts`**

```ts
import type { NewsItem } from '@/lib/types';

const BASE = 'https://finnhub.io/api/v1';

export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export async function getFinnhubNews(symbols: string[]): Promise<NewsItem[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const fetchJson = async (url: string) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    return res.json();
  };
  try {
    const general = (await fetchJson(`${BASE}/news?category=general&token=${key}`) as any[]).slice(0, 12);
    const perSymbol = await Promise.all(symbols.slice(0, 8).map(async sym => {
      try {
        const items = await fetchJson(`${BASE}/company-news?symbol=${sym}&from=${weekAgo}&to=${today}&token=${key}`) as any[];
        return items.slice(0, 5).map(n => ({ ...n, _sym: sym }));
      } catch { return []; }
    }));
    return [...general, ...perSymbol.flat()].map((n): NewsItem => ({
      id: String(n.id ?? n.url), title: n.headline, source: n.source ?? 'Finnhub', url: n.url,
      publishedAt: new Date((n.datetime ?? 0) * 1000).toISOString(),
      symbols: n._sym ? [n._sym] : (n.related ? String(n.related).split(',').filter(Boolean) : undefined),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/yahoo.test.ts` → PASS. Then `npm run build` → compiles.

- [ ] **Step 6: Live smoke check**

```bash
node -e "import('yahoo-finance2').then(async m => { const yf = m.default; const q = await yf.quote(['SPY','^VIX']); console.log(q.map(x=>x.symbol+' '+x.regularMarketPrice)); })"
```
Expected: prints SPY and ^VIX prices. If yahoo-finance2 v3 needs instantiation (`new m.default()`), adapt `yahoo.ts` accordingly and keep mappers pure.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: Yahoo Finance and optional Finnhub providers"`

---

### Task 8: Watchlist store + GEX snapshots

**Files:** Create: `src/lib/store.ts`, `src/lib/gex/snapshots.ts`, `tests/store.test.ts`

- [ ] **Step 1: Write failing tests `tests/store.test.ts`** (isolate via `GAMMADESK_DATA_DIR`)

```ts
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
```

- [ ] **Step 2: Run** — `npx vitest run tests/store.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/store.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL'];

export function dataDir(): string {
  const dir = process.env.GAMMADESK_DATA_DIR ?? path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

export function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function watchlistFile(): string { return path.join(dataDir(), 'watchlist.json'); }

export function readWatchlist(): string[] {
  const list = readJson<string[] | null>(watchlistFile(), null);
  if (list && Array.isArray(list)) return list;
  writeJson(watchlistFile(), DEFAULT_WATCHLIST);
  return [...DEFAULT_WATCHLIST];
}

export function addSymbol(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  const list = readWatchlist();
  if (sym && !list.includes(sym)) list.push(sym);
  writeJson(watchlistFile(), list);
  return list;
}

export function removeSymbol(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  const list = readWatchlist().filter(s => s !== sym);
  writeJson(watchlistFile(), list);
  return list;
}
```

- [ ] **Step 4: Implement `src/lib/gex/snapshots.ts`**

```ts
import path from 'node:path';
import fs from 'node:fs';
import type { GexSnapshot } from '@/lib/types';
import { dataDir, writeJson } from '@/lib/store';

const MAX_AGE_MS = 7 * 86_400_000;

function file(): string { return path.join(dataDir(), 'gex-snapshots.json'); }

function readAll(): GexSnapshot[] {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')) as GexSnapshot[]; } catch { return []; }
}

export function appendSnapshot(snap: GexSnapshot): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  const all = readAll().filter(s => s.ts >= cutoff);
  all.push(snap);
  writeJson(file(), all);
}

export function readSnapshots(symbol: string): GexSnapshot[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return readAll().filter(s => s.symbol === symbol && s.ts >= cutoff).sort((a, b) => a.ts - b.ts);
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/store.test.ts` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: watchlist and GEX snapshot JSON stores"`

---

### Task 9: API routes

**Files:** Create all route files listed in the file structure, plus `tests/routes.test.ts`

All routes follow one pattern: parse params → `getOrFetch(key, ttl, providerFn)` → `NextResponse.json(cached)`; on throw return `{ error }` with status 502. TTLs: quotes/search 15s, movers/sectors/news 60s, gex 5min, ratings/stats/earnings 15min, insights 5min.

- [ ] **Step 1: Create `src/app/api/quotes/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getQuotes } from '@/lib/providers/yahoo';

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get('symbols') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return NextResponse.json({ error: 'symbols required' }, { status: 400 });
  try {
    const cached = await getOrFetch(`quotes:${symbols.join(',')}`, 15_000, () => getQuotes(symbols));
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/search/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { searchTickers } from '@/lib/providers/yahoo';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ value: [], asOf: Date.now(), stale: false });
  try {
    const cached = await getOrFetch(`search:${q.toLowerCase()}`, 60_000, () => searchTickers(q));
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 3: Create `src/app/api/movers/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getMovers } from '@/lib/providers/yahoo';

export async function GET() {
  try {
    return NextResponse.json(await getOrFetch('movers', 60_000, getMovers));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 4: Create `src/app/api/sectors/route.ts`** — identical shape, key `sectors`, fn `getSectors`, ttl 60s.

```ts
import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getSectors } from '@/lib/providers/yahoo';

export async function GET() {
  try {
    return NextResponse.json(await getOrFetch('sectors', 60_000, getSectors));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 5: Create `src/app/api/news/route.ts`** (merges Yahoo + Finnhub; defaults to market symbols + watchlist)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { dedupeNews, getYahooNews } from '@/lib/providers/yahoo';
import { getFinnhubNews } from '@/lib/providers/finnhub';
import { readWatchlist } from '@/lib/store';

export async function GET(req: NextRequest) {
  const param = (req.nextUrl.searchParams.get('symbols') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const symbols = param.length ? param : ['SPY', 'QQQ', ...readWatchlist()].slice(0, 10);
  try {
    const cached = await getOrFetch(`news:${symbols.join(',')}`, 60_000, async () => {
      const [yahoo, finnhub] = await Promise.all([getYahooNews(symbols), getFinnhubNews(symbols)]);
      return dedupeNews([...yahoo, ...finnhub]).slice(0, 40);
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 6: Create `src/app/api/ratings/[symbol]/route.ts` and `src/app/api/stats/[symbol]/route.ts`**

```ts
// ratings/[symbol]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getRatings } from '@/lib/providers/yahoo';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    return NextResponse.json(await getOrFetch(`ratings:${sym}`, 900_000, () => getRatings(sym)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

```ts
// stats/[symbol]/route.ts — same with getStats and key `stats:`
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getStats } from '@/lib/providers/yahoo';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    return NextResponse.json(await getOrFetch(`stats:${sym}`, 900_000, () => getStats(sym)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 7: Create `src/app/api/earnings/route.ts`** (upcoming earnings across watchlist)

```ts
import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getStats } from '@/lib/providers/yahoo';
import { readWatchlist } from '@/lib/store';

export async function GET() {
  const symbols = readWatchlist();
  try {
    const cached = await getOrFetch(`earnings:${symbols.join(',')}`, 3_600_000, async () => {
      const stats = await Promise.all(symbols.map(s => getStats(s).catch(() => null)));
      return stats
        .filter((s): s is NonNullable<typeof s> => Boolean(s?.earningsDate))
        .map(s => ({ symbol: s.symbol, name: s.name, earningsDate: s.earningsDate! }))
        .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate));
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 8: Create `src/app/api/gex/[symbol]/route.ts`** (profile + per-symbol insights + snapshot append)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { fetchChain } from '@/lib/providers/cboe';
import { computeGex } from '@/lib/gex/compute';
import { appendSnapshot } from '@/lib/gex/snapshots';
import { gammaRegime, wallProximity, unusualActivity } from '@/lib/insights/rules';
import { isMarketOpen } from '@/lib/marketHours';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    const cached = await getOrFetch(`gex:${sym}`, 300_000, async () => {
      const chain = await fetchChain(sym);
      const profile = computeGex(chain);
      const insights = [gammaRegime(profile), wallProximity(profile), ...unusualActivity(chain)].filter(Boolean);
      if (isMarketOpen()) {
        appendSnapshot({ ts: Date.now(), symbol: sym, totalGex: profile.totalGex, flip: profile.flipPoint, spot: profile.spot });
      }
      return { profile, insights };
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 9: Create `src/app/api/gex/[symbol]/history/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { readSnapshots } from '@/lib/gex/snapshots';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return NextResponse.json({ value: readSnapshots(symbol.toUpperCase()), asOf: Date.now(), stale: false });
}
```

- [ ] **Step 10: Create `src/app/api/insights/route.ts`** (market-level: VIX + sector skew)

```ts
import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getQuotes, getSectors } from '@/lib/providers/yahoo';
import { vixContext, sectorSkew } from '@/lib/insights/rules';
import type { Insight } from '@/lib/types';

export async function GET() {
  try {
    const cached = await getOrFetch('insights:market', 300_000, async () => {
      const out: Insight[] = [];
      const [vix] = await getQuotes(['^VIX']).catch(() => []);
      if (vix?.price) out.push(vixContext(vix.price));
      const sectors = await getSectors().catch(() => []);
      const skew = sectorSkew(sectors);
      if (skew) out.push(skew);
      return out;
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
```

- [ ] **Step 11: Create `src/app/api/watchlist/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { addSymbol, readWatchlist, removeSymbol } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ value: readWatchlist(), asOf: Date.now(), stale: false });
}

export async function POST(req: NextRequest) {
  const { symbol } = await req.json().catch(() => ({}));
  if (!symbol || typeof symbol !== 'string') return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  return NextResponse.json({ value: addSymbol(symbol), asOf: Date.now(), stale: false });
}

export async function DELETE(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  return NextResponse.json({ value: removeSymbol(symbol), asOf: Date.now(), stale: false });
}
```

- [ ] **Step 12: Write route smoke test `tests/routes.test.ts`** (mock providers; verify the `Cached` envelope)

```ts
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
```

- [ ] **Step 13: Run tests + build** — `npx vitest run tests/routes.test.ts` → PASS; `npm run build` → compiles.

- [ ] **Step 14: Commit** — `git add -A && git commit -m "feat: API routes for quotes, search, movers, sectors, news, ratings, stats, earnings, gex, insights, watchlist"`

---

### Task 10: UI foundation — polling hook + shared bits

**Files:** Create: `src/hooks/usePolling.ts`, `src/components/ui.tsx`; Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/hooks/usePolling.ts`**

```ts
'use client';
import { useEffect, useRef, useState } from 'react';

export interface PollState<T> { data?: T; asOf?: number; stale?: boolean; error?: string; loading: boolean; }

/** Polls an API route returning the Cached<T> envelope ({value, asOf, stale}). url=null pauses. */
export function usePolling<T>(url: string | null, intervalMs: number): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ loading: true });
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    if (!url) { setState({ loading: false }); return; }
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(url);
        const body = await res.json();
        if (!active || urlRef.current !== url) return;
        if (!res.ok) { setState(s => ({ ...s, error: body.error ?? `HTTP ${res.status}`, loading: false })); return; }
        setState({ data: body.value as T, asOf: body.asOf, stale: body.stale, loading: false });
      } catch (err) {
        if (active) setState(s => ({ ...s, error: String(err), loading: false }));
      }
    };
    setState(s => ({ ...s, loading: s.data === undefined }));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [url, intervalMs]);

  return state;
}
```

- [ ] **Step 2: Create `src/components/ui.tsx`**

```tsx
'use client';
import { useState, type ReactNode } from 'react';
import { GLOSSARY } from '@/lib/insights/glossary';
import { fmtPct } from '@/lib/format';

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-panel border border-border rounded-lg ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function StaleBadge({ stale, asOf }: { stale?: boolean; asOf?: number }) {
  if (!asOf) return null;
  const time = new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <span className={`text-[10px] tabular ${stale ? 'text-warn' : 'text-muted'}`}>
      {stale ? `stale · ${time}` : time}
    </span>
  );
}

export function PriceChange({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`tabular ${value >= 0 ? 'text-up' : 'text-down'} ${className}`}>{fmtPct(value)}</span>
  );
}

/** ⓘ glossary popover. metric must be a GLOSSARY key. */
export function InfoTip({ metric }: { metric: string }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[metric];
  if (!entry) return null;
  return (
    <span className="relative inline-block">
      <button
        aria-label={`What is ${entry.term}?`}
        className="text-muted hover:text-accent text-[10px] border border-border rounded-full w-4 h-4 inline-flex items-center justify-center align-middle ml-1 cursor-help"
        onClick={() => setOpen(o => !o)} onBlur={() => setOpen(false)}
      >i</button>
      {open && (
        <span className="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-72 bg-panel2 border border-border rounded-lg p-3 text-xs shadow-xl block text-left">
          <span className="font-semibold text-text block mb-1">{entry.term}</span>
          <span className="text-muted block mb-2">{entry.short}</span>
          <span className="text-accent block">Why it matters: <span className="text-muted">{entry.why}</span></span>
        </span>
      )}
    </span>
  );
}

export function Spinner() {
  return <div className="text-muted text-xs animate-pulse p-4 text-center">loading…</div>;
}
```

- [ ] **Step 3: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GammaDesk',
  description: 'Personal trading dashboard — market trends, GEX, news and insights',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: polling hook and shared UI primitives"`

---

### Task 11: TopStrip, TickerSearch, WatchlistBar

**Files:** Create: `src/components/TopStrip.tsx`, `src/components/TickerSearch.tsx`, `src/components/WatchlistBar.tsx`

- [ ] **Step 1: Create `src/components/TickerSearch.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface Result { symbol: string; name: string; exch: string; }

export function TickerSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 1) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        setResults(body.value ?? []);
        setOpen(true);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const pick = (symbol: string) => { onSelect(symbol); setQ(''); setOpen(false); };

  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter' && q.trim()) pick(q.trim().toUpperCase()); }}
        placeholder="Search ticker…"
        className="bg-panel2 border border-border rounded-md px-3 py-1.5 text-sm w-56 outline-none focus:border-accent placeholder:text-muted"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-9 left-0 w-72 bg-panel2 border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map(r => (
            <li key={r.symbol}>
              <button onMouseDown={() => pick(r.symbol)} className="w-full text-left px-3 py-2 hover:bg-panel flex justify-between gap-2 text-sm">
                <span className="font-semibold">{r.symbol}</span>
                <span className="text-muted truncate">{r.name}</span>
                <span className="text-muted text-xs shrink-0">{r.exch}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/TopStrip.tsx`** (quotes ~15s + SPY regime badge from /api/gex/SPY)

```tsx
'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, QuoteLite } from '@/lib/types';
import { PriceChange, InfoTip, StaleBadge } from '@/components/ui';
import { TickerSearch } from '@/components/TickerSearch';

const STRIP = ['SPY', 'QQQ', '^SPX', '^VIX', '^TNX'];
const LABEL: Record<string, string> = { '^SPX': 'SPX', '^VIX': 'VIX', '^TNX': '10Y' };

export function TopStrip({ onSelectTicker }: { onSelectTicker: (s: string) => void }) {
  const quotes = usePolling<QuoteLite[]>(`/api/quotes?symbols=${encodeURIComponent(STRIP.join(','))}`, 15_000);
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>('/api/gex/SPY', 300_000);

  const regime = gex.data?.profile;
  const positive = (regime?.totalGex ?? 0) >= 0;

  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-panel border-b border-border">
      <h1 className="font-bold text-sm tracking-wide text-accent shrink-0">GammaDesk</h1>
      <div className="flex items-center gap-4 overflow-x-auto flex-1">
        {STRIP.map(sym => {
          const q = quotes.data?.find(x => x.symbol === sym);
          return (
            <button key={sym} onClick={() => onSelectTicker(sym.replace('^', ''))} className="flex items-baseline gap-1.5 shrink-0 hover:opacity-80">
              <span className="text-xs text-muted font-medium">{LABEL[sym] ?? sym}</span>
              <span className="text-sm tabular font-semibold">{q ? q.price.toFixed(2) : '—'}</span>
              {q && <PriceChange value={q.changePct} className="text-xs" />}
            </button>
          );
        })}
        {regime && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${positive ? 'border-up text-up' : 'border-down text-down'}`}>
            {positive ? '+GEX · pinned' : '−GEX · volatile'}
            <InfoTip metric="regime" />
          </span>
        )}
      </div>
      <StaleBadge stale={quotes.stale} asOf={quotes.asOf} />
      <TickerSearch onSelect={onSelectTicker} />
    </header>
  );
}
```

- [ ] **Step 3: Create `src/components/WatchlistBar.tsx`**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import type { QuoteLite } from '@/lib/types';
import { PriceChange } from '@/components/ui';

export function WatchlistBar({ onSelectTicker, activeTicker }: { onSelectTicker: (s: string) => void; activeTicker?: string }) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [adding, setAdding] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/watchlist');
    const body = await res.json();
    setSymbols(body.value ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const quotes = usePolling<QuoteLite[]>(symbols.length ? `/api/quotes?symbols=${symbols.join(',')}` : null, 15_000);

  const add = async () => {
    const sym = adding.trim().toUpperCase();
    if (!sym) return;
    await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: sym }) });
    setAdding('');
    refresh();
  };
  const remove = async (sym: string) => {
    await fetch(`/api/watchlist?symbol=${sym}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <footer className="flex items-center gap-2 px-4 py-2 bg-panel border-t border-border overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">Watchlist</span>
      {symbols.map(sym => {
        const q = quotes.data?.find(x => x.symbol === sym);
        return (
          <span key={sym} className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm shrink-0 cursor-pointer hover:border-accent ${activeTicker === sym ? 'border-accent bg-panel2' : 'border-border bg-panel2'}`}
            onClick={() => onSelectTicker(sym)}>
            <span className="font-semibold">{sym}</span>
            {q && <span className="tabular text-xs text-muted">{q.price.toFixed(2)}</span>}
            {q && <PriceChange value={q.changePct} className="text-xs" />}
            <button aria-label={`Remove ${sym}`} className="text-muted opacity-0 group-hover:opacity-100 hover:text-down text-xs ml-0.5"
              onClick={e => { e.stopPropagation(); remove(sym); }}>×</button>
          </span>
        );
      })}
      <input value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
        placeholder="+ add" className="bg-transparent border border-dashed border-border rounded-md px-2 py-1 text-xs w-20 outline-none focus:border-accent placeholder:text-muted shrink-0" />
    </footer>
  );
}
```

- [ ] **Step 4: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: top strip with regime badge, ticker search, watchlist bar"`

---

### Task 12: Right rail — news feed + insight cards

**Files:** Create: `src/components/RightRail.tsx`

- [ ] **Step 1: Create `src/components/RightRail.tsx`**

```tsx
'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, NewsItem } from '@/lib/types';
import { InfoTip, Spinner, StaleBadge } from '@/components/ui';

const SEV_STYLE: Record<Insight['severity'], string> = {
  info: 'border-l-accent', watch: 'border-l-warn', alert: 'border-l-down',
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function RightRail() {
  const news = usePolling<NewsItem[]>('/api/news', 60_000);
  const market = usePolling<Insight[]>('/api/insights', 300_000);
  const spy = usePolling<{ profile: GexProfile; insights: Insight[] }>('/api/gex/SPY', 300_000);

  const insights = [...(spy.data?.insights ?? []), ...(market.data ?? [])];

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-panel flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Insights</h3>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '45%' }}>
        {insights.length === 0 && <Spinner />}
        {insights.map(i => (
          <div key={i.id} className={`bg-panel2 border border-border border-l-2 ${SEV_STYLE[i.severity]} rounded-md p-2.5`}>
            <p className="text-xs font-semibold mb-1">{i.title}{i.metric && <InfoTip metric={i.metric} />}</p>
            <p className="text-xs text-muted leading-relaxed">{i.body}</p>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-y border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Live News</h3>
        <StaleBadge stale={news.stale} asOf={news.asOf} />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {news.loading && <Spinner />}
        {news.data?.map(n => (
          <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 rounded hover:bg-panel2">
            <p className="text-xs leading-snug">{n.title}</p>
            <p className="text-[10px] text-muted mt-0.5">
              {n.symbols?.length ? <span className="text-accent mr-1.5">{n.symbols.join(' ')}</span> : null}
              {n.source} · {timeAgo(n.publishedAt)} ago
            </p>
          </a>
        ))}
        {!news.loading && !news.data?.length && <p className="text-xs text-muted p-2">No news available.</p>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: right rail with live news feed and insight cards"`

---

### Task 13: Market view

**Files:** Create: `src/components/views/MarketView.tsx`

- [ ] **Step 1: Create `src/components/views/MarketView.tsx`**

```tsx
'use client';
import { usePolling } from '@/hooks/usePolling';
import type { QuoteLite } from '@/lib/types';
import { Panel, PriceChange, Spinner, StaleBadge } from '@/components/ui';
import { fmtNum } from '@/lib/format';

interface Sector { symbol: string; name: string; changePct: number; }
interface Movers { gainers: QuoteLite[]; losers: QuoteLite[]; actives: QuoteLite[]; }
interface Earning { symbol: string; name: string; earningsDate: string; }

function sectorBg(pct: number): string {
  const a = Math.min(Math.abs(pct) / 2.5, 1) * 0.55 + 0.08;
  return pct >= 0 ? `rgba(63,185,80,${a})` : `rgba(248,81,73,${a})`;
}

function MoversCol({ title, rows, onSelect }: { title: string; rows?: QuoteLite[]; onSelect: (s: string) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">{title}</p>
      <table className="w-full text-xs">
        <tbody>
          {(rows ?? []).map(q => (
            <tr key={q.symbol} className="cursor-pointer hover:bg-panel2" onClick={() => onSelect(q.symbol)}>
              <td className="py-1 font-semibold">{q.symbol}</td>
              <td className="py-1 tabular text-right">{q.price.toFixed(2)}</td>
              <td className="py-1 text-right"><PriceChange value={q.changePct} /></td>
              <td className="py-1 tabular text-right text-muted hidden xl:table-cell">{q.volume ? fmtNum(q.volume) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketView({ onSelectTicker }: { onSelectTicker: (s: string) => void }) {
  const sectors = usePolling<Sector[]>('/api/sectors', 60_000);
  const movers = usePolling<Movers>('/api/movers', 60_000);
  const earnings = usePolling<Earning[]>('/api/earnings', 3_600_000);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 overflow-y-auto">
      <Panel title="Sector performance" right={<StaleBadge stale={sectors.stale} asOf={sectors.asOf} />} className="lg:col-span-2">
        {sectors.loading ? <Spinner /> : (
          <div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-11 gap-1.5">
            {sectors.data?.map(s => (
              <button key={s.symbol} onClick={() => onSelectTicker(s.symbol)}
                className="rounded-md p-2 text-center hover:ring-1 hover:ring-accent" style={{ background: sectorBg(s.changePct) }}>
                <p className="text-xs font-bold">{s.symbol}</p>
                <p className="text-[10px] text-text/80 truncate">{s.name}</p>
                <p className="text-xs tabular font-semibold">{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%</p>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Movers" right={<StaleBadge stale={movers.stale} asOf={movers.asOf} />} className="lg:col-span-2">
        {movers.loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MoversCol title="Top gainers" rows={movers.data?.gainers} onSelect={onSelectTicker} />
            <MoversCol title="Top losers" rows={movers.data?.losers} onSelect={onSelectTicker} />
            <MoversCol title="Most active" rows={movers.data?.actives} onSelect={onSelectTicker} />
          </div>
        )}
      </Panel>

      <Panel title="Upcoming earnings (watchlist)" className="lg:col-span-2">
        {earnings.loading ? <Spinner /> : earnings.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {earnings.data.map(e => (
              <button key={e.symbol} onClick={() => onSelectTicker(e.symbol)}
                className="flex items-center gap-2 bg-panel2 border border-border rounded-md px-3 py-1.5 text-xs hover:border-accent">
                <span className="font-semibold">{e.symbol}</span>
                <span className="text-muted">{e.earningsDate}</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-muted">No upcoming earnings for watchlist names.</p>}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: market view — sector grid, movers, earnings calendar"`

---

### Task 14: GEX view

**Files:** Create: `src/components/gex/GexProfile.tsx`, `src/components/gex/GexHeatmap.tsx`, `src/components/gex/LevelsTable.tsx`, `src/components/gex/GexSparkline.tsx`, `src/components/views/GexView.tsx`

- [ ] **Step 1: Create `src/components/gex/GexProfile.tsx`** (centered-axis horizontal bars; spot/flip/wall markers)

```tsx
'use client';
import type { GexProfile as Profile } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

export function GexProfileChart({ profile }: { profile: Profile }) {
  const rows = [...profile.byStrike].sort((a, b) => b.strike - a.strike);
  const max = Math.max(1, ...rows.map(r => Math.abs(r.netGex)));
  const nearest = (target: number | null) =>
    target === null ? null : rows.reduce((best, r) => Math.abs(r.strike - target) < Math.abs(best.strike - target) ? r : best, rows[0])?.strike ?? null;
  const spotRow = nearest(profile.spot);
  const flipRow = nearest(profile.flipPoint);

  return (
    <div className="space-y-px">
      {rows.map(r => {
        const pct = Math.abs(r.netGex) / max * 50; // % of half-width
        const pos = r.netGex >= 0;
        return (
          <div key={r.strike} className={`flex items-center gap-2 text-[11px] rounded-sm px-1 ${r.strike === spotRow ? 'bg-panel2 ring-1 ring-accent/40' : ''}`}>
            <span className={`w-14 tabular text-right ${r.strike === profile.callWall ? 'text-up font-bold' : r.strike === profile.putWall ? 'text-down font-bold' : 'text-muted'}`}>
              {r.strike}
              {r.strike === profile.callWall ? ' ⊕' : r.strike === profile.putWall ? ' ⊖' : ''}
            </span>
            <div className="flex-1 relative h-3.5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              {flipRow === r.strike && <div className="absolute inset-y-0 left-0 right-0 border-t border-dashed border-warn top-1/2" />}
              <div
                className={`absolute inset-y-0.5 rounded-sm ${pos ? 'bg-up/70' : 'bg-down/70'}`}
                style={pos ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </div>
            <span className="w-16 tabular text-right text-muted">{fmtMoney(r.netGex)}</span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted pt-2">
        ⊕ call wall · ⊖ put wall · highlighted row ≈ spot ({profile.spot.toFixed(2)}) · dashed = flip {profile.flipPoint ? `(${profile.flipPoint.toFixed(1)})` : '(n/a)'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/gex/GexHeatmap.tsx`**

```tsx
'use client';
import type { GexProfile } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

function cellColor(v: number, max: number): string {
  if (v === 0) return 'transparent';
  const a = Math.min(Math.abs(v) / max, 1) * 0.85 + 0.06;
  return v > 0 ? `rgba(63,185,80,${a})` : `rgba(248,81,73,${a})`;
}

export function GexHeatmap({ profile }: { profile: GexProfile }) {
  const { expiries, strikes, values } = profile.heatmap;
  if (!expiries.length) return <p className="text-xs text-muted">No heatmap data.</p>;
  const desc = [...strikes].sort((a, b) => b - a);
  const max = Math.max(1, ...values.flat().map(Math.abs));
  const get = (e: number, k: number) => values[e][strikes.indexOf(k)] ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] tabular border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-muted text-right pr-1 font-normal sticky left-0 bg-panel">strike</th>
            {expiries.map(e => <th key={e} className="text-muted font-normal px-1">{e.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {desc.map(k => (
            <tr key={k}>
              <td className={`text-right pr-1 sticky left-0 bg-panel ${k === profile.callWall ? 'text-up font-bold' : k === profile.putWall ? 'text-down font-bold' : 'text-muted'}`}>{k}</td>
              {expiries.map((e, ei) => {
                const v = get(ei, k);
                return (
                  <td key={e} title={`${k} @ ${e}: ${fmtMoney(v)}`}
                    className="w-9 h-5 text-center rounded-sm text-text/90"
                    style={{ background: cellColor(v, max) }}>
                    {Math.abs(v) / max > 0.35 ? fmtMoney(v).replace('$', '') : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted mt-1.5">Green = positive net gamma (stabilizing) · Red = negative (destabilizing) · columns are expiries (MM-DD)</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/gex/LevelsTable.tsx`**

```tsx
'use client';
import type { GexProfile } from '@/lib/types';
import { InfoTip } from '@/components/ui';
import { fmtMoney } from '@/lib/format';

export function LevelsTable({ profile }: { profile: GexProfile }) {
  const rows: { label: string; metric: string; value: string; cls?: string }[] = [
    { label: 'Spot', metric: 'regime', value: profile.spot.toFixed(2) },
    { label: 'Total net GEX', metric: 'gex', value: fmtMoney(profile.totalGex), cls: profile.totalGex >= 0 ? 'text-up' : 'text-down' },
    { label: 'Zero-gamma flip', metric: 'flip', value: profile.flipPoint ? profile.flipPoint.toFixed(1) : 'n/a', cls: 'text-warn' },
    { label: 'Call wall', metric: 'callWall', value: profile.callWall ? String(profile.callWall) : 'n/a', cls: 'text-up' },
    { label: 'Put wall', metric: 'putWall', value: profile.putWall ? String(profile.putWall) : 'n/a', cls: 'text-down' },
  ];
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(r => (
          <tr key={r.label} className="border-b border-border last:border-0">
            <td className="py-1.5 text-muted">{r.label}<InfoTip metric={r.metric} /></td>
            <td className={`py-1.5 text-right tabular font-semibold ${r.cls ?? ''}`}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Create `src/components/gex/GexSparkline.tsx`** (SVG polyline of intraday totalGex)

```tsx
'use client';
import type { GexSnapshot } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

export function GexSparkline({ snapshots }: { snapshots: GexSnapshot[] }) {
  if (snapshots.length < 2) return <p className="text-xs text-muted">Collecting snapshots — history appears after a few refresh cycles.</p>;
  const w = 280, h = 60, pad = 4;
  const vals = snapshots.map(s => s.totalGex);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + i / (snapshots.length - 1) * (w - 2 * pad);
  const y = (v: number) => h - pad - (v - min) / span * (h - 2 * pad);
  const points = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  const last = vals[vals.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        {zeroY !== null && <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="var(--color-border)" strokeDasharray="3 3" />}
        <polyline points={points} fill="none" stroke={last >= 0 ? 'var(--color-up)' : 'var(--color-down)'} strokeWidth="1.5" />
      </svg>
      <p className="text-[10px] text-muted">Total net GEX over recent sessions · latest {fmtMoney(last)}</p>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/views/GexView.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, GexSnapshot, Insight } from '@/lib/types';
import { Panel, Spinner, StaleBadge, InfoTip } from '@/components/ui';
import { GexProfileChart } from '@/components/gex/GexProfile';
import { GexHeatmap } from '@/components/gex/GexHeatmap';
import { LevelsTable } from '@/components/gex/LevelsTable';
import { GexSparkline } from '@/components/gex/GexSparkline';

const PRESETS = ['SPY', 'QQQ', 'SPX', 'IWM'];

export function GexView() {
  const [symbol, setSymbol] = useState('SPY');
  const [custom, setCustom] = useState('');
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>(`/api/gex/${symbol}`, 300_000);
  const history = usePolling<GexSnapshot[]>(`/api/gex/${symbol}/history`, 300_000);

  const profile = gex.data?.profile;

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(s => (
          <button key={s} onClick={() => setSymbol(s)}
            className={`px-3 py-1 rounded-md text-xs font-semibold border ${symbol === s ? 'border-accent text-accent bg-panel2' : 'border-border text-muted hover:border-accent'}`}>
            {s}
          </button>
        ))}
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { setSymbol(custom.trim().toUpperCase()); setCustom(''); } }}
          placeholder="other…" className="bg-panel2 border border-border rounded-md px-2 py-1 text-xs w-20 outline-none focus:border-accent placeholder:text-muted" />
        <span className="ml-auto"><StaleBadge stale={gex.stale} asOf={gex.asOf} /></span>
      </div>

      {gex.error && <Panel><p className="text-xs text-down">Couldn&apos;t load options data for {symbol}: {gex.error}. Non-optionable tickers have no GEX.</p></Panel>}
      {gex.loading && <Spinner />}

      {profile && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <Panel title={<>Net GEX by strike — {symbol}<InfoTip metric="gex" /></>} className="xl:col-span-2 xl:row-span-2">
            <GexProfileChart profile={profile} />
          </Panel>
          <Panel title="Key levels"><LevelsTable profile={profile} /></Panel>
          <Panel title="GEX history"><GexSparkline snapshots={history.data ?? []} /></Panel>
          <Panel title={<>Strike × expiry heatmap<InfoTip metric="oi" /></>} className="xl:col-span-3">
            <GexHeatmap profile={profile} />
          </Panel>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: GEX view — profile chart, heatmap, levels, history sparkline"`

---

### Task 15: Ticker view + TradingView chart

**Files:** Create: `src/components/TradingViewChart.tsx`, `src/components/views/TickerView.tsx`

- [ ] **Step 1: Create `src/components/TradingViewChart.tsx`** (official embed; realtime via user's TV login)

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function TradingViewChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: '15',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#10151d',
      gridColor: '#1e2735',
      hide_top_toolbar: false,
      allow_symbol_change: false,
      studies: ['STD;VWAP'],
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);
    return () => { el.innerHTML = ''; };
  }, [symbol]);

  return <div ref={ref} className="tradingview-widget-container h-full w-full" />;
}
```

- [ ] **Step 2: Create `src/components/views/TickerView.tsx`**

```tsx
'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, NewsItem, QuoteLite } from '@/lib/types';
import { Panel, PriceChange, Spinner, StaleBadge, InfoTip } from '@/components/ui';
import { TradingViewChart } from '@/components/TradingViewChart';
import { GexProfileChart } from '@/components/gex/GexProfile';
import { fmtMoney, fmtNum } from '@/lib/format';

interface Ratings {
  consensus: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  meanRating: number | null; ratingKey: string | null;
  targetMean: number | null; targetHigh: number | null; targetLow: number | null;
  history: { firm: string; action: string; fromGrade: string; toGrade: string; date: string | null }[];
}
interface Stats {
  symbol: string; name: string; marketCap: number | null; peRatio: number | null; forwardPe: number | null;
  week52High: number | null; week52Low: number | null; avgVolume: number | null; beta: number | null;
  shortPctFloat: number | null; earningsDate: string | null;
}

function ConsensusBar({ c }: { c: NonNullable<Ratings['consensus']> }) {
  const total = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell || 1;
  const seg = (n: number, color: string, label: string) => n > 0 && (
    <div key={label} title={`${label}: ${n}`} style={{ width: `${n / total * 100}%`, background: color }} className="h-2 first:rounded-l-full last:rounded-r-full" />
  );
  return (
    <div>
      <div className="flex w-full gap-px mb-1">
        {seg(c.strongBuy, '#3fb950', 'Strong buy')}{seg(c.buy, '#7ee2a8', 'Buy')}{seg(c.hold, '#d29922', 'Hold')}{seg(c.sell, '#f0883e', 'Sell')}{seg(c.strongSell, '#f85149', 'Strong sell')}
      </div>
      <p className="text-[10px] text-muted">{c.strongBuy + c.buy} buy · {c.hold} hold · {c.sell + c.strongSell} sell</p>
    </div>
  );
}

export function TickerView({ symbol }: { symbol: string }) {
  const quote = usePolling<QuoteLite[]>(`/api/quotes?symbols=${symbol}`, 15_000);
  const stats = usePolling<Stats>(`/api/stats/${symbol}`, 900_000);
  const ratings = usePolling<Ratings>(`/api/ratings/${symbol}`, 900_000);
  const news = usePolling<NewsItem[]>(`/api/news?symbols=${symbol}`, 60_000);
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>(`/api/gex/${symbol}`, 300_000);

  const q = quote.data?.[0];
  const s = stats.data;
  const r = ratings.data;

  const statRows: { label: string; value: string }[] = s ? [
    { label: 'Market cap', value: s.marketCap ? fmtMoney(s.marketCap) : '—' },
    { label: 'P/E (ttm)', value: s.peRatio ? s.peRatio.toFixed(1) : '—' },
    { label: '52w range', value: s.week52Low && s.week52High ? `${s.week52Low.toFixed(2)} – ${s.week52High.toFixed(2)}` : '—' },
    { label: 'Avg volume', value: s.avgVolume ? fmtNum(s.avgVolume) : '—' },
    { label: 'Beta', value: s.beta ? s.beta.toFixed(2) : '—' },
    { label: 'Short % float', value: s.shortPctFloat ? `${(s.shortPctFloat * 100).toFixed(1)}%` : '—' },
    { label: 'Next earnings', value: s.earningsDate ?? '—' },
  ] : [];

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{symbol}</h2>
        {s?.name && <span className="text-sm text-muted">{s.name}</span>}
        {q && <>
          <span className="text-xl tabular font-semibold">{q.price.toFixed(2)}</span>
          <PriceChange value={q.changePct} className="text-sm" />
          <span className="text-xs text-muted tabular">{q.dayLow?.toFixed(2)} – {q.dayHigh?.toFixed(2)} day range</span>
        </>}
        <span className="ml-auto"><StaleBadge stale={quote.stale} asOf={quote.asOf} /></span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Panel className="xl:col-span-2" title="Chart (TradingView — realtime with your login)">
          <div className="h-[420px]"><TradingViewChart symbol={symbol} /></div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Analyst ratings">
            {ratings.loading ? <Spinner /> : r?.consensus ? (
              <div className="space-y-3">
                <ConsensusBar c={r.consensus} />
                {r.targetMean && q && (
                  <p className="text-xs text-muted">
                    Avg target <span className="text-text tabular font-semibold">{r.targetMean.toFixed(2)}</span>
                    {' '}({((r.targetMean / q.price - 1) * 100).toFixed(1)}% vs spot) · range {r.targetLow?.toFixed(0)}–{r.targetHigh?.toFixed(0)}
                  </p>
                )}
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {r.history.map((h, i) => (
                    <p key={i} className="text-[11px] text-muted">
                      <span className={h.action === 'up' ? 'text-up' : h.action === 'down' ? 'text-down' : ''}>
                        {h.action === 'up' ? '▲' : h.action === 'down' ? '▼' : '•'}
                      </span>{' '}
                      <span className="text-text">{h.firm}</span> {h.fromGrade ? `${h.fromGrade} → ` : ''}{h.toGrade} <span>{h.date ?? ''}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-muted">No analyst coverage found.</p>}
          </Panel>

          <Panel title="Key stats">
            {stats.loading ? <Spinner /> : (
              <table className="w-full text-xs">
                <tbody>
                  {statRows.map(row => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="py-1 text-muted">{row.label}</td>
                      <td className="py-1 text-right tabular">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel className="xl:col-span-2" title={`News — ${symbol}`}>
          {news.loading ? <Spinner /> : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {news.data?.map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 rounded hover:bg-panel2">
                  <p className="text-xs">{n.title}</p>
                  <p className="text-[10px] text-muted">{n.source} · {new Date(n.publishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </a>
              ))}
              {!news.data?.length && <p className="text-xs text-muted">No recent news.</p>}
            </div>
          )}
        </Panel>

        <Panel title={<>GEX profile<InfoTip metric="gex" /></>}>
          {gex.error ? <p className="text-xs text-muted">No listed options for {symbol}.</p>
            : gex.loading ? <Spinner />
            : gex.data ? <GexProfileChart profile={gex.data.profile} /> : null}
        </Panel>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit** — `npm run build` → compiles. `git add -A && git commit -m "feat: ticker view — TradingView chart, ratings, stats, news, mini GEX"`

---

### Task 16: Page assembly, README, final verification

**Files:** Modify: `src/app/page.tsx`; Create: `README.md` (replace scaffold one)

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { TopStrip } from '@/components/TopStrip';
import { RightRail } from '@/components/RightRail';
import { WatchlistBar } from '@/components/WatchlistBar';
import { MarketView } from '@/components/views/MarketView';
import { GexView } from '@/components/views/GexView';
import { TickerView } from '@/components/views/TickerView';

type View = 'market' | 'gex' | 'ticker';
const TABS: { id: View; label: string }[] = [
  { id: 'market', label: 'Market' }, { id: 'gex', label: 'GEX' }, { id: 'ticker', label: 'Ticker' },
];

export default function Home() {
  const [view, setView] = useState<View>('market');
  const [ticker, setTicker] = useState('SPY');

  const selectTicker = (s: string) => { setTicker(s.toUpperCase()); setView('ticker'); };

  return (
    <div className="flex flex-col h-screen">
      <TopStrip onSelectTicker={selectTicker} />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <nav className="flex gap-1 px-3 pt-2 border-b border-border">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`px-4 py-1.5 text-sm rounded-t-md border border-b-0 ${view === t.id ? 'bg-panel border-border text-text font-semibold' : 'border-transparent text-muted hover:text-text'}`}>
                {t.label}{t.id === 'ticker' ? ` · ${ticker}` : ''}
              </button>
            ))}
            <span className="ml-auto self-center text-[10px] text-muted pr-1">
              Educational tool · options data ~15-min delayed · not financial advice
            </span>
          </nav>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {view === 'market' && <MarketView onSelectTicker={selectTicker} />}
            {view === 'gex' && <GexView />}
            {view === 'ticker' && <TickerView symbol={ticker} />}
          </div>
        </main>
        <RightRail />
      </div>
      <WatchlistBar onSelectTicker={selectTicker} activeTicker={ticker} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `README.md`**

```markdown
# GammaDesk

Personal trading dashboard: live market trends, self-computed gamma exposure (GEX), ticker news/ratings, and plain-English insights. Local-first, free data sources.

## Run

\`\`\`bash
npm install
npm run dev    # http://localhost:3000
\`\`\`

Optional: copy `.env.example` to `.env.local` and add a free [Finnhub](https://finnhub.io) key for richer news.

## Data sources

- **CBOE delayed quotes** — options chains with greeks/OI (~15-min delayed) → GEX engine
- **Yahoo Finance** — quotes, movers, sectors, news, analyst ratings, stats
- **TradingView embeds** — charts (realtime if you're logged into TradingView)

## Notes

- GEX convention: calls positive, puts negative (dealer-positioning assumption); strikes ±15% of spot, expiries ≤60 DTE.
- All metrics have ⓘ explainers in the UI. Educational tool — not financial advice.
- Tests: `npm test`
\`\`\`
```
(Write the README with real code fences, not escaped ones.)

- [ ] **Step 3: Full test suite + build**

```bash
npm test && npm run build
```
Expected: all tests PASS, build compiles.

- [ ] **Step 4: Manual QA with dev server** — `npm run dev`, then verify in browser (or with the browse/QA skill):
  1. Top strip shows SPY/QQQ/SPX/VIX/10Y quotes and a regime badge.
  2. Market view: sector tiles colored by performance; movers tables populated; clicking a row opens Ticker view.
  3. GEX view: SPY profile renders with flip/walls; heatmap renders; switching to QQQ works; a junk symbol shows the friendly error.
  4. Ticker view: TradingView chart loads; ratings consensus bar + history; stats table; news list; mini GEX profile.
  5. Right rail: insights cards with ⓘ popovers working; news feed links open in new tabs.
  6. Watchlist: add `AMD`, remove it; chips show live prices; persists across reload.
  7. Footer disclaimer visible.

- [ ] **Step 5: Fix anything broken, then commit** — `git add -A && git commit -m "feat: assemble dashboard shell with view tabs and README"`

---

## Self-review checklist (done at planning time)

- **Spec coverage:** market trends (Task 13), GEX profile/heatmap/levels/history (Tasks 5, 14), ticker search + news + ratings + stats (Tasks 7, 11, 15), insights + glossary explainers (Task 6, surfaced in 12/14/15), watchlist (Tasks 8, 11), top strip + regime badge (11), TradingView realtime charts (15), stale-data badges + per-panel error isolation (2, 10, all views), market-hours snapshot gating (3, 9), disclaimer (16). Earnings calendar scoped to watchlist names (9, 13) per spec's "watchlist names highlighted" intent.
- **Known adaptation points:** CBOE payload field names and yahoo-finance2 v3 API shape must be verified against live responses in Tasks 4/7 smoke steps; tests pin the normalized contract so only provider internals would change.
- **Types:** `Cached<T>` envelope used by every route and `usePolling`; `GexProfile`/`Insight`/`QuoteLite`/`NewsItem` shared across engine, routes, and components.


