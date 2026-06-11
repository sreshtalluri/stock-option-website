import { NextRequest, NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getQuotes } from '@/lib/providers/yahoo';

export async function GET(req: NextRequest) {
  const symbols = (req.nextUrl.searchParams.get('symbols') ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return NextResponse.json({ error: 'symbols required' }, { status: 400 });
  try {
    const cached = await getOrFetch(`quotes:${symbols.join(',')}`, 15_000, () => getQuotes(symbols));
    return NextResponse.json(cached);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
