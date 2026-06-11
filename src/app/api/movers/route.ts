import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getMovers } from '@/lib/providers/yahoo';

export async function GET() {
  try {
    return NextResponse.json(await getOrFetch('movers', 60_000, getMovers));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
