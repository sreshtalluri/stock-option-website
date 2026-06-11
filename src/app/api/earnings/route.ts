import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getStats } from '@/lib/providers/yahoo';
import { readWatchlist } from '@/lib/store';

export async function GET() {
  const symbols = readWatchlist();
  try {
    const cached = await getOrFetch(`earnings:${symbols.join(',')}`, 3_600_000, async () => {
      const stats = await Promise.all(symbols.map(s => getStats(s).catch(() => null)));
      return stats
        .filter((s): s is NonNullable<typeof s> => Boolean(s?.earningsDate))
        .map(s => ({ symbol: s.symbol, name: s.name, earningsDate: s.earningsDate! }))
        .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate));
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
