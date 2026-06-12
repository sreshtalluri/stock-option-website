'use client';
import { useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, GexSnapshot, Insight } from '@/lib/types';
import { Panel, Spinner, StaleBadge, InfoTip } from '@/components/ui';
import { GexProfileChart } from '@/components/gex/GexProfile';
import { GexHeatmap } from '@/components/gex/GexHeatmap';
import { LevelsTable } from '@/components/gex/LevelsTable';
import { GexSparkline } from '@/components/gex/GexSparkline';
import { DexChart } from '@/components/gex/DexChart';
import { IvTermStructure } from '@/components/gex/IvTermStructure';

const PRESETS = ['SPY', 'QQQ', 'SPX', 'IWM'];

export function GexView() {
  const [symbol, setSymbol] = useState('SPY');
  const [custom, setCustom] = useState('');
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>(`/api/gex/${symbol}`, 300_000);
  const history = usePolling<GexSnapshot[]>(`/api/gex/${symbol}/history`, 300_000);

  const profile = gex.data?.profile;

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(s => (
          <button key={s} onClick={() => setSymbol(s)}
            className={`px-3 py-1 rounded-md text-xs font-semibold border ${symbol === s ? 'border-accent text-accent bg-panel2' : 'border-border text-muted hover:border-accent'}`}>
            {s}
          </button>
        ))}
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { setSymbol(custom.trim().toUpperCase()); setCustom(''); } }}
          placeholder="other…" className="bg-panel2 border border-border rounded-md px-2 py-1 text-xs w-20 outline-none focus:border-accent placeholder:text-muted" />
        <span className="ml-auto"><StaleBadge stale={gex.stale} asOf={gex.asOf} /></span>
      </div>

      {gex.error && <Panel><p className="text-xs text-down">Couldn&apos;t load options data for {symbol}. Non-optionable tickers have no GEX. ({gex.error})</p></Panel>}
      {gex.loading && <Spinner />}

      {profile && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* row 1: profile chart (wide) + levels + history */}
          <Panel title={<>Net GEX by strike — {symbol}<InfoTip metric="gex" /></>} className="xl:col-span-2 xl:row-span-2">
            <GexProfileChart profile={profile} />
          </Panel>
          <Panel title="Key levels"><LevelsTable profile={profile} /></Panel>
          <Panel title="GEX history"><GexSparkline snapshots={history.data ?? []} /></Panel>

          {/* row 2: heatmap full-width */}
          <Panel title={<>Strike × expiry heatmap<InfoTip metric="oi" /></>} className="xl:col-span-3">
            <GexHeatmap profile={profile} />
          </Panel>

          {/* row 3: DEX + IV term structure */}
          <Panel title={<>DEX — Dealer Delta Exposure<InfoTip metric="gex" /></>} className="xl:col-span-2">
            <DexChart profile={profile} />
          </Panel>
          <Panel title="IV Term Structure">
            <IvTermStructure profile={profile} />
          </Panel>
        </div>
      )}
    </div>
  );
}
