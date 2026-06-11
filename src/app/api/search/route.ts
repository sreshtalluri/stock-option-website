import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { searchTickers } from '@/lib/providers/yahoo';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ value: [], asOf: Date.now(), stale: false });
  try {
    const cached = await getOrFetch(`search:${q.toLowerCase()}`, 60_000, () => searchTickers(q));
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
