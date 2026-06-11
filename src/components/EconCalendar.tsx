'use client';
import { usePolling } from '@/hooks/usePolling';
import type { EconEvent } from '@/lib/types';
import { Panel, Spinner, StaleBadge, InfoTip } from '@/components/ui';

const IMPACT_DOT: Record<EconEvent['impact'], string> = {
  high: 'bg-down', medium: 'bg-warn', low: 'bg-muted/50',
};
const IMPACT_ORDER: Record<EconEvent['impact'], number> = { high: 0, medium: 1, low: 2 };

function etDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
}
function etTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
}

export function EconCalendar() {
  const econ = usePolling<EconEvent[]>('/api/econ-calendar', 3_600_000);
  const today = etDay(new Date().toISOString());

  // upcoming first; hide low-impact noise unless it's today
  const events = (econ.data ?? [])
    .filter(e => new Date(e.date).getTime() > Date.now() - 12 * 3_600_000)
    .filter(e => e.impact !== 'low' || etDay(e.date) === today);

  const byDay = new Map<string, EconEvent[]>();
  for (const e of events) {
    const day = etDay(e.date);
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
  }

  return (
    <Panel title={<>Key market dates<InfoTip metric="econ" /></>} right={<StaleBadge stale={econ.stale} asOf={econ.asOf} />}>
      {econ.loading ? <Spinner /> : econ.error ? (
        <p className="text-xs text-muted">Calendar feed unavailable right now.</p>
      ) : !events.length ? (
        <p className="text-xs text-muted">No medium/high-impact US releases left this week.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
          {[...byDay.entries()].map(([day, list]) => (
            <div key={day}>
              <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${day === today ? 'text-accent font-semibold' : 'text-muted'}`}>
                {day}{day === today ? ' · today' : ''}
              </p>
              <div className="space-y-1">
                {list.map(e => (
                  <div key={e.id} className="flex items-start gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${IMPACT_DOT[e.impact]}`} title={`${e.impact} impact`} />
                    <span className="text-muted tabular w-14 shrink-0">{etTime(e.date)}</span>
                    <span className="min-w-0">
                      <span className={e.impact === 'high' ? 'font-semibold' : ''}>{e.title}</span>
                      {(e.forecast || e.previous) && (
                        <span className="text-muted text-[10px] block">
                          {e.forecast ? `f: ${e.forecast}` : ''}{e.forecast && e.previous ? ' · ' : ''}{e.previous ? `prev: ${e.previous}` : ''}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted mt-3">
        <span className="inline-block w-2 h-2 rounded-full bg-down align-middle mr-1" />high impact
        <span className="inline-block w-2 h-2 rounded-full bg-warn align-middle ml-3 mr-1" />medium
        <span className="ml-3">All times ET · FOMC dates from the Fed&apos;s published schedule</span>
      </p>
    </Panel>
  );
}
