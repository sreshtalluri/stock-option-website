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
      body: `${c.volume.toLocaleString()} contracts traded vs ${c.openInterest.toLocaleString()} open interest (${(c.volume / c.openInterest).toFixed(1)}x) at the ${c.strike} strike. Heavy new positioning — someone is making a fresh bet here.`,
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
