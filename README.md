# GammaDesk

Personal trading dashboard: live market trends, self-computed gamma exposure (GEX), ticker news/ratings, and plain-English insights. Local-first, free data sources.

## Run

```bash
npm install
npm run dev    # http://localhost:3000
```

Optional: copy `.env.example` to `.env.local` and add a free [Finnhub](https://finnhub.io) key for richer news.

## What's on screen

- **Top strip** — SPY / QQQ / SPX / VIX / 10Y live quotes + the day's gamma regime badge, plus ticker search.
- **Market view** — sector performance heat tiles, top gainers/losers/actives, upcoming watchlist earnings.
- **GEX view** — net gamma exposure by strike (with zero-gamma flip, call wall, put wall), strike×expiry heatmap, intraday GEX history.
- **Ticker view** — realtime TradingView chart, analyst consensus + upgrades/downgrades, key stats, news, per-ticker GEX.
- **Right rail** — always-on live news feed and plain-English insight cards.
- **Watchlist bar** — persistent watchlist chips with live prices (stored in `data/watchlist.json`).

Every metric has an ⓘ explainer — what it is, why it matters, how traders use it.

## Data sources

- **CBOE delayed quotes** — options chains with greeks/OI (~15-min delayed) → GEX engine
- **Yahoo Finance** — quotes, movers, sectors, news, analyst ratings, stats
- **TradingView embeds** — charts (realtime if you're logged into TradingView)

## Notes

- GEX convention: calls positive, puts negative (dealer-positioning assumption); strikes ±15% of spot, expiries ≤60 DTE.
- Educational tool — not financial advice.
- Tests: `npm test`
