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
    short: "Dollar change in dealers' delta hedge for a 1-vol-point move in implied volatility. Green = dealers buy when vol drops (bullish); purple = dealers sell when vol drops (bearish). Empty cells = no open interest at that strike/expiry.",
    why: "Most powerful around events like FOMC and CPI. If a big green VEX cluster sits above spot and vol is about to crush, dealers will buy the underlying → stock rips even on a 'meh' outcome. Purple dominant below spot after a vol spike = vol-crush selling pressure. VEX explains the classic 'sell the event, buy the crush' and vice versa.",
  },
  gexHeatmap: {
    term: 'GEX Heatmap — How to Read It',
    short: "Each cell is one strike × one expiry. Color = net dealer gamma in dollars. Green = dealers long gamma here (they sell into rallies, buy dips — stabilizing). Purple = dealers short gamma (they chase price — destabilizing). Empty dark cells = zero or near-zero open interest at that strike/expiry combo — no one owns options there, so it has no gravitational pull on price.",
    why: "The NEAREST expiry column drives intraday behavior. Find the brightest green cell near spot in today's column — that strike is the likely pin target for the session. Brightest green ABOVE spot = call wall (natural resistance/ceiling). Brightest purple BELOW spot = put wall (floor, but if broken, a gap-down accelerates). As you move RIGHT across columns, you see longer-term structure. A strike with green across multiple expiries is a very sticky, high-conviction level.",
  },
  vexHeatmap: {
    term: 'VEX Heatmap — How to Read It',
    short: "Same layout as GEX but shows vanna (sensitivity to IV moves). Empty dark cells = zero OI there. Green cells = when vol drops, dealers must buy stock to re-hedge delta (bullish flow). Purple cells = when vol drops, dealers sell stock (bearish flow). Near-term columns dominate on event days.",
    why: "Switch to VEX on FOMC/CPI/earnings days. Step 1: Find spot. Step 2: Look at the nearest expiry column. Step 3: If the dominant color above spot is green, a vol crush will be mechanically bullish. If dominant color below is purple, a vol crush will be bearish. This is why stocks sometimes rip after 'good enough' earnings — the VEX structure forces dealer buying as IV collapses.",
  },
  dex: {
    term: 'DEX — Dealer Delta Exposure',
    short: "Net directional exposure of dealer hedges at each strike. Blue bars = dealers net long delta (they will sell stock as price rises to stay neutral = overhead sell pressure). Orange bars = dealers net short delta (they will buy stock as price drops = natural support below).",
    why: "DEX shows where mechanical buy and sell flows live — not based on sentiment, but pure hedging math. A cluster of orange bars just below spot = dealers will buy dips there, creating cushion. A cluster of blue bars above spot = dealers will sell into rallies, creating resistance. When price moves through a heavy DEX level, the flow reverses sharply — those are the levels where moves often pause or accelerate.",
  },
  ivTerm: {
    term: 'IV Term Structure — How to Read It',
    short: "ATM implied volatility for each expiry date plotted as a line. Normal shape (contango) slopes gently upward — further out = slightly more IV. Backwardation means near-term IV is HIGHER than far-term — the market is pricing more fear for the near future than the long run.",
    why: "Contango = calm tape, normal conditions. Trade spreads and collect premium normally. Backwardation = near-term event risk (upcoming CPI, FOMC, earnings). The steeper the inversion, the more fear is priced near-term. After the event passes and IV crushes, the structure snaps back to contango — that crush can be violent in either direction. Watch for a sudden shift from contango to backwardation as an early warning of a vol spike.",
  },
};
