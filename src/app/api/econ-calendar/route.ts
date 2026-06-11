import { NextResponse } from 'next/server';
import { getOrFetch } from '@/lib/cache';
import { fetchEconCalendar } from '@/lib/providers/econCalendar';

export async function GET() {
  try {
    return NextResponse.json(await getOrFetch('econ-calendar', 3_600_000, () => fetchEconCalendar()));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
