import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { dedupeNews, getYahooNews } from '@/lib/providers/yahoo';
import { getFinnhubNews } from '@/lib/providers/finnhub';
import { readWatchlist } from '@/lib/store';

export async function GET(req: NextRequest) {
  const param = (req.nextUrl.searchParams.get('symbols') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const symbols = param.length ? param : [...new Set(['SPY', 'QQQ', ...readWatchlist()])].slice(0, 10);
  try {
    const cached = await getOrFetch(`news:${symbols.join(',')}`, 60_000, async () => {
      const [yahoo, finnhub] = await Promise.all([getYahooNews(symbols), getFinnhubNews(symbols)]);
      return dedupeNews([...yahoo, ...finnhub]).slice(0, 40);
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
