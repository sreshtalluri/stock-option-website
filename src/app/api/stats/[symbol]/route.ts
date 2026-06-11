import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getStats } from '@/lib/providers/yahoo';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase();
  try {
    return NextResponse.json(await getOrFetch(`stats:${sym}`, 900_000, () => getStats(sym)));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
