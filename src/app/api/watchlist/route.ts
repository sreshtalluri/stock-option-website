import { NextRequest, NextResponse } from 'next/server';
import { addSymbol, readWatchlist, removeSymbol } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ value: readWatchlist(), asOf: Date.now(), stale: false });
}

export async function POST(req: NextRequest) {
  const { symbol } = await req.json().catch(() => ({}));
  if (!symbol || typeof symbol !== 'string') return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  return NextResponse.json({ value: addSymbol(symbol), asOf: Date.now(), stale: false });
}

export async function DELETE(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  return NextResponse.json({ value: removeSymbol(symbol), asOf: Date.now(), stale: false });
}
