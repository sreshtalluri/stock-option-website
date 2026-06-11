import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getQuotes, getSectors } from '@/lib/providers/yahoo';
import { fetchEconCalendar } from '@/lib/providers/econCalendar';
import { vixContext, sectorSkew, econEventRisk } from '@/lib/insights/rules';
import type { Insight } from '@/lib/types';

export async function GET() {
  try {
    const cached = await getOrFetch('insights:market', 300_000, async () => {
      const out: Insight[] = [];
      const econ = await fetchEconCalendar().catch(() => []);
      const econRisk = econEventRisk(econ);
      if (econRisk) out.push(econRisk);
      const [vix] = await getQuotes(['^VIX']).catch(() => []);
      if (vix?.price) out.push(vixContext(vix.price));
      const sectors = await getSectors().catch(() => []);
      const skew = sectorSkew(sectors);
      if (skew) out.push(skew);
      return out;
    });
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
