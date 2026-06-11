# GammaDesk — Personal Trading Dashboard (Design Spec)

**Date:** 2026-06-11
**Status:** Draft — awaiting user review
**Owner:** Sreshta

## Purpose

A local-first web dashboard kept open during market hours to support day/swing trading decisions. It shows general market trends, computes and visualizes gamma exposure (GEX), lets the user search any ticker for news/analyst ratings/key stats, and explains every metric in plain English (the user is actively learning while trading — mainly swing, sometimes day trades).

## Constraints & decisions

- **Free data only for v1.** Paid providers may be added later; the data layer must make that a drop-in change.
- **Local-first.** Runs on the user's Mac with one command (`npm run dev` / `npm start`), opens in a browser. No auth, single user. Cloud deploy (Railway) is a future option, not v1.
- **Both index and single-name focus.** Index GEX (SPY/QQQ/SPX) is the default, plus a personal watchlist of single names with deep-dive views.
- **Layout C — Hybrid:** persistent top market strip, switchable main stage (Market / GEX / Ticker), always-visible right rail (news + insights), bottom watchlist bar. Desktop-first, dark theme.
- **Learning emphasis:** every metric carries an ⓘ explainer (what it is, why it matters, how to use it).

## Architecture

Single **Next.js (App Router) + TypeScript + Tailwind CSS** app. Server-side API routes fetch upstream data, normalize it, compute GEX/insights, and cache responses with per-source TTLs. The client uses SWR-style polling against those routes:

| Data | Refresh | Source |
|---|---|---|
| Quotes (strip, watchlist, movers) | ~15s | Yahoo Finance |
| News | ~60s | Yahoo (default), Finnhub (if key present) |
| Options chains / GEX | ~5 min (market hours) | CBOE delayed quotes |
| Analyst ratings, fundamentals, earnings | ~15 min / on view | Yahoo Finance |
| Charts | true realtime | TradingView embed widgets (user's Premium login) |

No database. A local `data/` directory holds JSON files: `watchlist.json` (tickers + settings) and `gex-snapshots.json` (periodic total-GEX snapshots for an intraday history sparkline; pruned after ~5 trading days).

### Data layer (`src/lib/providers/`)

Provider interfaces so sources are swappable without touching UI or engines:

- `OptionsChainProvider` — v1: **CBOE delayed quotes** (`https://cdn.cboe.com/api/global/delayed_quotes/options/{symbol}.json`; index symbols use underscore prefix, e.g. `_SPX`). Returns normalized chain: per contract {type, strike, expiry, gamma, IV, OI, volume, bid/ask, last} + spot + quote timestamp. ~15-min delayed.
- `QuoteProvider` — v1: **Yahoo Finance** (`yahoo-finance2` npm). Quotes, batch quotes, index/ETF/VIX/^TNX, day gainers/losers/most-actives screeners, ticker search/autocomplete, historical prices.
- `NewsProvider` — v1: **Yahoo** news search per ticker + market headlines; **Finnhub** (free key in `.env.local`, optional) for richer company + general news. If no Finnhub key, Yahoo only — feature degrades, never breaks.
- `RatingsProvider` — v1: **Yahoo** `recommendationTrend`, `upgradeDowngradeHistory`, price targets where available; Finnhub recommendation trends as supplement.

All providers: in-memory TTL cache, exponential backoff on failure, and a `stale: boolean` + `asOf: timestamp` on every payload so the UI can badge stale data instead of erroring.

### GEX engine (`src/lib/gex/`)

Pure functions over a normalized chain (fully unit-testable):

- Per contract: `GEX = gamma × OI × 100 × spot² × 0.01` (dollar gamma per 1% move). Calls contribute **positive**, puts **negative** (standard dealer-positioning assumption — stated in the UI explainer).
- Filters: strikes within ±15% of spot; expiries ≤ 60 days (both configurable constants).
- Outputs:
  - **Net GEX by strike** (the profile chart)
  - **Strike × expiry net-GEX matrix** (the heatmap)
  - **Total net GEX** (in $Bn per 1% move)
  - **Zero-gamma flip point** (interpolated where cumulative net GEX crosses zero)
  - **Call wall** (max positive-GEX strike) and **put wall** (max negative-GEX strike)
- A snapshot job (server-side, on each GEX fetch during market hours) appends `{ts, symbol, totalGex, flip, spot}` to `gex-snapshots.json`.

### Insights engine (`src/lib/insights/`)

Deterministic rule-based generators (no LLM — free, instant, predictable). Each rule emits `{severity, title, body, relatedMetric}`. v1 rules:

1. **Gamma regime** — sign/size of total net GEX → pinning vs volatility-expansion explanation, with the flip level and what crossing it would mean.
2. **Wall proximity** — spot distance to call/put wall → likely magnet/resistance behavior.
3. **Vol context** — VIX level bands (low/normal/elevated/extreme) with what that implies for option buying vs selling.
4. **Ratings shift** (ticker view) — recent upgrades/downgrades and consensus drift.
5. **Earnings proximity** (ticker + watchlist) — warn when a holding/viewed name reports within 7 days (IV crush risk explained).
6. **Unusual options activity** (ticker view) — volume/OI ratio outliers in the day's chain.
7. **Market breadth/sector skew** — sector ETF dispersion summary for the Market view.

Plus a **glossary** module: every metric ID maps to a plain-English explainer (definition, why it matters, how traders use it) rendered as ⓘ popovers.

## UI

Dark financial-dashboard theme. Desktop-first (≥1280px primary target).

- **Top strip (always visible):** SPY, QQQ, SPX, VIX, 10Y (^TNX) mini-quotes with change %; gamma-regime badge (e.g. "+GEX · pinned"); ticker search with autocomplete.
- **Main stage (3 views, client-side tabs):**
  - **Market:** sector performance grid (XLK/XLF/XLE/… ETFs), top gainers/losers/most-active tables, this-week earnings calendar (watchlist names highlighted), market-summary insight card.
  - **GEX:** symbol selector (SPY/QQQ/SPX + any optionable ticker); horizontal net-GEX-by-strike bar profile with spot line, flip line, wall markers; strike×expiry heatmap; key-levels table (flip, walls, total GEX, largest strikes); intraday total-GEX sparkline from snapshots.
  - **Ticker:** quote header (price, change, day range, volume); TradingView advanced chart embed (realtime via user's Premium); analyst ratings panel (consensus gauge, recent upgrades/downgrades, price targets); key stats (market cap, P/E, 52w range, next earnings date); ticker news list; per-ticker mini GEX profile when an options chain exists.
- **Right rail (always visible):** merged live news feed (market + watchlist tickers, newest first, source + timestamp) and insight cards as they fire.
- **Bottom watchlist bar:** ticker chips (price + % change, red/green), click → Ticker view; add/remove inline; persisted server-side to `data/watchlist.json`. Seeded with SPY, QQQ, NVDA, TSLA, AAPL.
- **Footer disclaimer:** educational tool; options data ~15-min delayed; not financial advice.

## Error handling

- Every panel fetches independently; one source failing never blanks another panel.
- On upstream failure: render last cached data with a "stale since HH:MM" badge; retry with backoff.
- Outside market hours: show last session's data labeled "as of close"; GEX polling pauses.
- Missing Finnhub key: news silently uses Yahoo only.
- Non-optionable ticker: GEX sections show a clear "no listed options" state.

## Testing

- **Vitest** unit tests: GEX math against a fixture chain with hand-computed expected values (profile, flip interpolation, walls, totals); insights rules (each rule's trigger boundaries); provider response parsers against saved fixture JSON from CBOE/Yahoo.
- API route smoke tests with mocked providers.
- Manual QA pass (browse/QA skill) against the running app before calling it done.

## Out of scope (v1)

Trade execution/broker hooks, price or GEX alerts/notifications, auth/multi-user, mobile layout, backtesting, paid data providers (interfaces ready, adapters later), options-flow scanner, cloud deployment.

## Future ideas (explicitly later)

Railway deploy for any-device access; alert rules (price/GEX level crossings) with push notifications; paid provider adapters (Polygon, Unusual Whales) for true realtime options; LLM-composed daily briefings; broker integration for positions context.
