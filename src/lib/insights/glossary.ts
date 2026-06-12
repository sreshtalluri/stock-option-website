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
    short: "The market's priced-in expectation of future movement, derived from option prices.",
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
    short: "Today's contract volume divided by existing open interest.",
    why: '≥3x with real size usually means fresh positioning (not closing) — someone is placing a new bet worth noting.',
  },
  regime: {
    term: 'Gamma Regime',
    short: 'Shorthand for whether the market is in positive (pinned) or negative (volatile) net gamma.',
    why: 'The single most useful daily context: it sets expectations for range, chop, and follow-through.',
  },
  earnings: {
    term: 'Earnings Proximity',
    short: 'How close a company is to its next earnings report.',
    why: 'IV inflates into earnings and crushes after. Holding long options through a report risks losing premium even when direction is right.',
  },
  econ: {
    term: 'Economic Calendar Risk',
    short: 'Scheduled macro releases — CPI, jobs report (NFP), FOMC rate decisions, PPI, GDP — that hit at known times and move the whole market.',
    why: 'High-impact prints cause sharp, fast repricing across indexes. Day traders flatten or size down into them; swing traders check the calendar before entering so a release doesn\'t land mid-trade.',
  },
  sectors: {
    term: 'Sector Dispersion',
    short: 'How differently the 11 S&P sectors are performing today.',
    why: 'Wide spread = rotation day (stock-picking matters); narrow spread = correlated tape (index direction dominates).',
  },
  vex: {
    term: 'VEX — Vanna Exposure',
    short: "Dollar change in dealers' delta hedge for a 1-point move in implied volatility. Green = dealers buy when vol drops; purple = dealers sell when vol drops.",
    why: "When VIX spikes, dealers must re-hedge their vanna exposure. A large negative VEX below spot means a vol-crush rip is loaded — the vol drop forces dealers to buy the underlying, pushing price up.",
  },
  dex: {
    term: 'DEX — Dealer Delta Exposure',
    short: "Net dealer delta (directional exposure) at each strike. Blue = dealers net long delta (will sell into rallies); orange = dealers net short delta (will buy dips).",
    why: "Large dealer delta imbalances create mechanical buy/sell flows as price moves. It tells you where natural support and resistance exist from pure hedging mechanics, not sentiment.",
  },
  ivTerm: {
    term: 'IV Term Structure',
    short: "ATM implied volatility plotted across expiry dates — showing whether near-term options are pricing more or less fear than longer-dated ones.",
    why: "Backwardation (near IV > far IV) = stress, event risk, or earnings nearby. Contango (normal upward slope) = calm tape. A sudden shift to backwardation often precedes big moves.",
  },
};
