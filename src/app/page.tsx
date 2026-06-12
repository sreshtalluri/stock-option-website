'use client';
import { useEffect, useRef, useState } from 'react';
import { TopStrip } from '@/components/TopStrip';
import { RightRail } from '@/components/RightRail';
import { WatchlistBar } from '@/components/WatchlistBar';
import { MarketView } from '@/components/views/MarketView';
import { GexView } from '@/components/views/GexView';
import { TickerView } from '@/components/views/TickerView';

type View = 'market' | 'gex' | 'ticker';
const TABS: { id: View; label: string }[] = [
  { id: 'market', label: 'Market' }, { id: 'gex', label: 'GEX' }, { id: 'ticker', label: 'Ticker' },
];

export default function Home() {
  const [view, setView] = useState<View>('market');
  const [ticker, setTicker] = useState('SPY');
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Reset tab scroll to top whenever the active view changes
  useEffect(() => { mainScrollRef.current && (mainScrollRef.current.scrollTop = 0); }, [view]);

  const selectTicker = (s: string) => { setTicker(s.toUpperCase()); setView('ticker'); };

  return (
    <div className="flex flex-col h-screen">
      <TopStrip onSelectTicker={selectTicker} />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <nav className="flex gap-1 px-3 pt-2 border-b border-border items-center">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`px-4 py-1.5 text-sm rounded-t-md border border-b-0 ${view === t.id ? 'bg-panel border-border text-text font-semibold' : 'border-transparent text-muted hover:text-text'}`}>
                {t.label}{t.id === 'ticker' ? ` · ${ticker}` : ''}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted pr-1">
              Educational tool · options data ~15-min delayed · not financial advice
            </span>
          </nav>
          <div ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {view === 'market' && <MarketView onSelectTicker={selectTicker} />}
            {view === 'gex' && <GexView />}
            {view === 'ticker' && <TickerView symbol={ticker} />}
          </div>
        </main>
        <RightRail />
      </div>
      <WatchlistBar onSelectTicker={selectTicker} activeTicker={ticker} />
    </div>
  );
}
