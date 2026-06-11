import type { EconEvent } from '@/lib/types';

// ForexFactory's free weekly calendar feed (this week only, refreshed continuously)
const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

// Fed-published 2026 FOMC meeting schedule — decision announced 2:00 PM ET on the second day
export const FOMC_2026 = [
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
];

interface FfRaw { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; }

export function mapFfEvents(raw: FfRaw[]): EconEvent[] {
  return raw
    .filter(e => e.country === 'USD')
    .map(e => ({
      id: `ff-${e.date}-${e.title}`,
      title: e.title,
      date: e.date,
      impact: (e.impact ?? 'low').toLowerCase() === 'high' ? 'high' as const
        : (e.impact ?? 'low').toLowerCase() === 'medium' ? 'medium' as const : 'low' as const,
      forecast: e.forecast || undefined,
      previous: e.previous || undefined,
      source: 'feed' as const,
    }));
}

const FOMC_TITLES = /fomc|federal funds rate|fed interest rate/i;

/** Adds scheduled FOMC decision dates within horizonDays unless the feed already covers that day. */
export function mergeFomc(events: EconEvent[], now: Date = new Date(), horizonDays = 45): EconEvent[] {
  const horizonMs = horizonDays * 86_400_000;
  const coveredDays = new Set(events.filter(e => FOMC_TITLES.test(e.title)).map(e => e.date.slice(0, 10)));
  const extra: EconEvent[] = FOMC_2026
    .filter(d => {
      const t = new Date(`${d}T14:00:00-04:00`).getTime();
      return t >= now.getTime() - 6 * 3_600_000 && t - now.getTime() <= horizonMs && !coveredDays.has(d);
    })
    .map(d => ({
      id: `fomc-${d}`,
      title: 'FOMC Rate Decision (scheduled)',
      date: `${d}T14:00:00-04:00`,
      impact: 'high' as const,
      source: 'fomc-schedule' as const,
    }));
  return [...events, ...extra].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEconCalendar(now: Date = new Date()): Promise<EconEvent[]> {
  const res = await fetch(FF_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Econ calendar: HTTP ${res.status}`);
  const events = mapFfEvents((await res.json()) as FfRaw[]);
  return mergeFomc(events, now);
}
