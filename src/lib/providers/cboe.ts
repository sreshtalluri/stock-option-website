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

interface CboeRawOption { option: string; gamma?: number; iv?: number; open_interest?: number; volume?: number; }
interface CboeRaw { data: { current_price?: number; close?: number; options?: CboeRawOption[] }; timestamp?: string; }

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
