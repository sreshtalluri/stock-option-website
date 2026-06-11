import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { getSectors } from '@/lib/providers/yahoo';

export async function GET() {
  try {
    return NextResponse.json(await getOrFetch('sectors', 60_000, getSectors));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
