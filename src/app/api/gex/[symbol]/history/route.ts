import { NextRequest, NextResponse } from 'next/server';
import { readSnapshots } from '@/lib/gex/snapshots';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return NextResponse.json({ value: readSnapshots(symbol.toUpperCase()), asOf: Date.now(), stale: false });
}
