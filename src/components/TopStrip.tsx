'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, QuoteLite } from '@/lib/types';
import { PriceChange, InfoTip, StaleBadge } from '@/components/ui';
import { TickerSearch } from '@/components/TickerSearch';

const STRIP = ['SPY', 'QQQ', '^SPX', '^VIX', '^TNX'];
const LABEL: Record<string, string> = { '^SPX': 'SPX', '^VIX': 'VIX', '^TNX': '10Y' };

export function TopStrip({ onSelectTicker }: { onSelectTicker: (s: string) => void }) {
  const quotes = usePolling<QuoteLite[]>(`/api/quotes?symbols=${encodeURIComponent(STRIP.join(','))}`, 15_000);
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>('/api/gex/SPY', 300_000);

  const regime = gex.data?.profile;
  const positive = (regime?.totalGex ?? 0) >= 0;

  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-panel border-b border-border">
      <h1 className="font-bold text-sm tracking-wide text-accent shrink-0">GammaDesk</h1>
      <div className="flex items-center gap-4 overflow-x-auto flex-1">
        {STRIP.map(sym => {
          const q = quotes.data?.find(x => x.symbol === sym);
          return (
            <button key={sym} onClick={() => onSelectTicker(sym.replace('^', ''))} className="flex items-baseline gap-1.5 shrink-0 hover:opacity-80">
              <span className="text-xs text-muted font-medium">{LABEL[sym] ?? sym}</span>
              <span className="text-sm tabular font-semibold">{q ? q.price.toFixed(2) : '—'}</span>
              {q && <PriceChange value={q.changePct} className="text-xs" />}
            </button>
          );
        })}
        {regime && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${positive ? 'border-up text-up' : 'border-down text-down'}`}>
            {positive ? '+GEX · pinned' : '−GEX · volatile'}
            <InfoTip metric="regime" />
          </span>
        )}
      </div>
      <StaleBadge stale={quotes.stale} asOf={quotes.asOf} />
      <TickerSearch onSelect={onSelectTicker} />
    </header>
  );
}
