import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { fetchChain } from '@/lib/providers/cboe';
import { computeGex } from '@/lib/gex/compute';
import { appendSnapshot } from '@/lib/gex/snapshots';
import { gammaRegime, wallProximity, unusualActivity } from '@/lib/insights/rules';
import { isMarketOpen } from '@/lib/marketHours';
import type { Insight } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    const cached = await getOrFetch(`gex:${sym}`, 300_000, async () => {
      const chain = await fetchChain(sym);
      const profile = computeGex(chain);
      const insights = [gammaRegime(profile), wallProximity(profile), ...unusualActivity(chain)]
        .filter((i): i is Insight => Boolean(i));
      if (isMarketOpen()) {
        appendSnapshot({ ts: Date.now(), symbol: sym, totalGex: profile.totalGex, flip: profile.flipPoint, spot: profile.spot });
      }
      return { profile, insights };
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
