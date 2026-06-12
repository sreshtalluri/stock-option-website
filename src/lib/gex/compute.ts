import type { DexByStrike, GexByStrike, GexProfile, IvPoint, OptionsChain } from '@/lib/types';

const MULTIPLIER = 100;
const MOVE = 0.01; // dollar gamma per 1% move
const RISK_FREE = 0.05; // assumed risk-free rate for d1/d2

export interface GexComputeOptions { strikeRangePct?: number; maxDte?: number; now?: Date; }

function normalCDF(x: number): number {
  // Abramowitz & Stegun approximation — accurate to ~1e-7
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const n = 1 - (Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? n : 1 - n;
}

/** Compute BS d1 and d2. Returns null when inputs are degenerate. */
function bsD1D2(S: number, K: number, iv: number, T: number): [number, number] | null {
  if (iv <= 0 || T <= 0 || S <= 0 || K <= 0) return null;
  const d1 = (Math.log(S / K) + (RISK_FREE + 0.5 * iv * iv) * T) / (iv * Math.sqrt(T));
  const d2 = d1 - iv * Math.sqrt(T);
  return [d1, d2];
}

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
  const dexMap = new Map<number, number>(); // strike -> net DEX
  const gexCellMap = new Map<string, number>(); // `${expiry}|${strike}` -> net GEX
  const vexCellMap = new Map<string, number>(); // `${expiry}|${strike}` -> net VEX
  // IV term structure: expiry -> { sumIv, count }
  const ivMap = new Map<string, { sumIv: number; count: number }>();

  for (const c of eligible) {
    const gex = c.gamma * c.openInterest * perUnit * (c.type === 'call' ? 1 : -1);
    const row = byStrikeMap.get(c.strike) ?? { strike: c.strike, netGex: 0, callGex: 0, putGex: 0 };
    row.netGex += gex;
    if (c.type === 'call') row.callGex += gex; else row.putGex += gex;
    byStrikeMap.set(c.strike, row);

    const gexKey = `${c.expiry}|${c.strike}`;
    gexCellMap.set(gexKey, (gexCellMap.get(gexKey) ?? 0) + gex);

    // VEX: vanna = -gamma × d2 × sqrt(T), derived from Black-Scholes using available gamma
    const T = Math.max(0, (new Date(`${c.expiry}T16:00:00-05:00`).getTime() - now.getTime()) / (365.25 * 86_400_000));
    const d1d2 = bsD1D2(spot, c.strike, c.iv, T);
    if (d1d2) {
      const [d1, d2] = d1d2;
      const vanna = -c.gamma * d2 * Math.sqrt(T);
      // VEX: dollar change in dealer delta for 1 vol-point move; calls add, puts subtract (same sign convention as GEX)
      const vex = vanna * c.openInterest * MULTIPLIER * spot * (c.type === 'call' ? 1 : -1);
      vexCellMap.set(gexKey, (vexCellMap.get(gexKey) ?? 0) + vex);

      // DEX: dealer net delta approximated from d1 (N(d1) for calls, N(d1)-1 for puts)
      const delta = c.type === 'call' ? normalCDF(d1) : normalCDF(d1) - 1;
      // Dealer is on opposite side — negate delta for dealer perspective
      const dealerDelta = -delta * c.openInterest * MULTIPLIER;
      dexMap.set(c.strike, (dexMap.get(c.strike) ?? 0) + dealerDelta);
    }

    // IV term structure: ATM-ish options per expiry, skipping expired/0DTE (T < 1 day)
    if (T > 1 / 365 && Math.abs(c.strike - spot) / spot <= 0.03 && c.iv > 0 && c.iv < 2.0) {
      const iv = ivMap.get(c.expiry) ?? { sumIv: 0, count: 0 };
      iv.sumIv += c.iv;
      iv.count += 1;
      ivMap.set(c.expiry, iv);
    }
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
  const heatValues = expiries.map(e => strikes.map(k => gexCellMap.get(`${e}|${k}`) ?? 0));
  const vexValues = expiries.map(e => strikes.map(k => vexCellMap.get(`${e}|${k}`) ?? 0));

  const dex: DexByStrike[] = [...dexMap.entries()]
    .map(([strike, netDex]) => ({ strike, netDex }))
    .sort((a, b) => a.strike - b.strike);

  const ivTermStructure: IvPoint[] = expiries
    .map(e => {
      const d = ivMap.get(e);
      return d && d.count > 0 ? { expiry: e, atmIv: d.sumIv / d.count } : null;
    })
    .filter((x): x is IvPoint => x !== null);

  return {
    symbol: chain.symbol, spot, asOf: chain.asOf, totalGex,
    flipPoint, callWall, putWall, byStrike,
    heatmap: { expiries, strikes, values: heatValues },
    vexHeatmap: { expiries, strikes, values: vexValues },
    dex,
    ivTermStructure,
  };
}
