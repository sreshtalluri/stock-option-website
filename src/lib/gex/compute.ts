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
