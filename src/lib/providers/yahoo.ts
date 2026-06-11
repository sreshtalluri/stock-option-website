import YahooFinance from 'yahoo-finance2';
import type { NewsItem, QuoteLite } from '@/lib/types';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

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
  const res = await yf.quote(symbols);
  return (Array.isArray(res) ? res : [res]).map(mapQuote);
}

export async function searchTickers(q: string): Promise<{ symbol: string; name: string; exch: string }[]> {
  const res: any = await yf.search(q, { quotesCount: 8, newsCount: 0 });
  return (res.quotes ?? [])
    .filter((r: any) => r.symbol && (r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'INDEX'))
    .map((r: any) => ({ symbol: r.symbol, name: r.shortname ?? r.longname ?? r.symbol, exch: r.exchDisp ?? '' }));
}

export async function getMovers(): Promise<{ gainers: QuoteLite[]; losers: QuoteLite[]; actives: QuoteLite[] }> {
  const run = async (scrIds: string) => {
    const res: any = await yf.screener({ scrIds: scrIds as any, count: 8 });
    return ((res.quotes ?? []) as any[]).map(mapQuote);
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
      const res: any = await yf.search(sym, { quotesCount: 0, newsCount: 6 });
      return ((res.news ?? []) as any[]).map((n): NewsItem => ({
        id: n.uuid ?? n.link, title: n.title, source: n.publisher ?? 'Yahoo',
        url: n.link, publishedAt: new Date(n.providerPublishTime ?? Date.now()).toISOString(), symbols: [sym],
      }));
    } catch { return []; }
  }));
  return dedupeNews(lists.flat());
}

export async function getRatings(symbol: string) {
  const res: any = await yf.quoteSummary(symbol, {
    modules: ['recommendationTrend', 'upgradeDowngradeHistory', 'financialData'] as any,
  });
  const trend = res.recommendationTrend?.trend?.[0] ?? null;
  const history = ((res.upgradeDowngradeHistory?.history ?? []) as any[]).slice(0, 10).map((h: any) => ({
    firm: h.firm, action: h.action, fromGrade: h.fromGrade ?? '', toGrade: h.toGrade ?? '',
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
  const res: any = await yf.quoteSummary(symbol, {
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
