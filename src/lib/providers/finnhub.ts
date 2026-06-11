import type { NewsItem } from '@/lib/types';

const BASE = 'https://finnhub.io/api/v1';

export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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
    const general = ((await fetchJson(`${BASE}/news?category=general&token=${key}`)) as any[]).slice(0, 12);
    const perSymbol = await Promise.all(symbols.slice(0, 8).map(async sym => {
      try {
        const items = (await fetchJson(`${BASE}/company-news?symbol=${sym}&from=${weekAgo}&to=${today}&token=${key}`)) as any[];
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
/* eslint-enable @typescript-eslint/no-explicit-any */
