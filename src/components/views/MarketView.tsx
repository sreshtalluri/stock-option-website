'use client';
import { usePolling } from '@/hooks/usePolling';
import type { QuoteLite } from '@/lib/types';
import { Panel, PriceChange, Spinner, StaleBadge } from '@/components/ui';
import { fmtNum } from '@/lib/format';

interface Sector { symbol: string; name: string; changePct: number; }
interface Movers { gainers: QuoteLite[]; losers: QuoteLite[]; actives: QuoteLite[]; }
interface Earning { symbol: string; name: string; earningsDate: string; }

function sectorBg(pct: number): string {
  const a = Math.min(Math.abs(pct) / 2.5, 1) * 0.55 + 0.08;
  return pct >= 0 ? `rgba(63,185,80,${a})` : `rgba(248,81,73,${a})`;
}

function MoversCol({ title, rows, onSelect }: { title: string; rows?: QuoteLite[]; onSelect: (s: string) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">{title}</p>
      <table className="w-full text-xs">
        <tbody>
          {(rows ?? []).map(q => (
            <tr key={q.symbol} className="cursor-pointer hover:bg-panel2" onClick={() => onSelect(q.symbol)}>
              <td className="py-1 font-semibold">{q.symbol}</td>
              <td className="py-1 tabular text-right">{q.price.toFixed(2)}</td>
              <td className="py-1 text-right"><PriceChange value={q.changePct} /></td>
              <td className="py-1 tabular text-right text-muted hidden xl:table-cell">{q.volume ? fmtNum(q.volume) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketView({ onSelectTicker }: { onSelectTicker: (s: string) => void }) {
  const sectors = usePolling<Sector[]>('/api/sectors', 60_000);
  const movers = usePolling<Movers>('/api/movers', 60_000);
  const earnings = usePolling<Earning[]>('/api/earnings', 3_600_000);

  return (
    <div className="grid grid-cols-1 gap-3 p-3 overflow-y-auto">
      <Panel title="Sector performance" right={<StaleBadge stale={sectors.stale} asOf={sectors.asOf} />}>
        {sectors.loading ? <Spinner /> : (
          <div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-11 gap-1.5">
            {sectors.data?.map(s => (
              <button key={s.symbol} onClick={() => onSelectTicker(s.symbol)}
                className="rounded-md p-2 text-center hover:ring-1 hover:ring-accent" style={{ background: sectorBg(s.changePct) }}>
                <p className="text-xs font-bold">{s.symbol}</p>
                <p className="text-[10px] text-text/80 truncate">{s.name}</p>
                <p className="text-xs tabular font-semibold">{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%</p>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Movers" right={<StaleBadge stale={movers.stale} asOf={movers.asOf} />}>
        {movers.loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MoversCol title="Top gainers" rows={movers.data?.gainers} onSelect={onSelectTicker} />
            <MoversCol title="Top losers" rows={movers.data?.losers} onSelect={onSelectTicker} />
            <MoversCol title="Most active" rows={movers.data?.actives} onSelect={onSelectTicker} />
          </div>
        )}
      </Panel>

      <Panel title="Upcoming earnings (watchlist)">
        {earnings.loading ? <Spinner /> : earnings.data?.length ? (
          <div className="flex flex-wrap gap-2">
            {earnings.data.map(e => (
              <button key={e.symbol} onClick={() => onSelectTicker(e.symbol)}
                className="flex items-center gap-2 bg-panel2 border border-border rounded-md px-3 py-1.5 text-xs hover:border-accent">
                <span className="font-semibold">{e.symbol}</span>
                <span className="text-muted">{e.earningsDate}</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-muted">No upcoming earnings for watchlist names.</p>}
      </Panel>
    </div>
  );
}
