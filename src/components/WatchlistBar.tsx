'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import type { QuoteLite } from '@/lib/types';
import { PriceChange } from '@/components/ui';

export function WatchlistBar({ onSelectTicker, activeTicker }: { onSelectTicker: (s: string) => void; activeTicker?: string }) {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [adding, setAdding] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist');
      const body = await res.json();
      setSymbols(body.value ?? []);
    } catch { /* keep last list */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const quotes = usePolling<QuoteLite[]>(symbols.length ? `/api/quotes?symbols=${symbols.join(',')}` : null, 15_000);

  const add = async () => {
    const sym = adding.trim().toUpperCase();
    if (!sym) return;
    await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: sym }) });
    setAdding('');
    refresh();
  };
  const remove = async (sym: string) => {
    await fetch(`/api/watchlist?symbol=${sym}`, { method: 'DELETE' });
    refresh();
  };

  return (
    <footer className="flex items-center gap-2 px-4 py-2 bg-panel border-t border-border overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wider text-muted shrink-0">Watchlist</span>
      {symbols.map(sym => {
        const q = quotes.data?.find(x => x.symbol === sym);
        return (
          <span key={sym} className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm shrink-0 cursor-pointer hover:border-accent bg-panel2 ${activeTicker === sym ? 'border-accent' : 'border-border'}`}
            onClick={() => onSelectTicker(sym)}>
            <span className="font-semibold">{sym}</span>
            {q && <span className="tabular text-xs text-muted">{q.price.toFixed(2)}</span>}
            {q && <PriceChange value={q.changePct} className="text-xs" />}
            <button aria-label={`Remove ${sym}`} className="text-muted opacity-0 group-hover:opacity-100 hover:text-down text-xs ml-0.5"
              onClick={e => { e.stopPropagation(); remove(sym); }}>×</button>
          </span>
        );
      })}
      <input value={adding} onChange={e => setAdding(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
        placeholder="+ add" className="bg-transparent border border-dashed border-border rounded-md px-2 py-1 text-xs w-20 outline-none focus:border-accent placeholder:text-muted shrink-0" />
    </footer>
  );
}
