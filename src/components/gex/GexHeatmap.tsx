'use client';
import { useEffect, useRef, useState } from 'react';
import type { GexProfile } from '@/lib/types';
import { InfoTip } from '@/components/ui';

type Mode = 'gex' | 'vex';

function fmtCell(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function cellStyle(v: number, max: number): React.CSSProperties {
  if (v === 0 || max === 0) return {};
  const intensity = Math.min(Math.abs(v) / max, 1);
  const alpha = intensity * 0.82 + 0.08;
  if (v > 0) {
    return { background: `rgba(52,211,153,${alpha})`, color: intensity > 0.55 ? '#0a0e14' : '#e6edf3' };
  }
  return { background: `rgba(139,92,246,${alpha})`, color: intensity > 0.55 ? '#e6edf3' : '#c4b5fd' };
}

// Show label when cell intensity >= 8% of max (was 20% — too few labels)
const LABEL_THRESHOLD = 0.08;

const GEX_GUIDE = [
  { icon: '🟢', text: 'Brightest green near spot in the LEFT column = today\'s likely pin. Price is magnetically attracted to it into close.' },
  { icon: '🟣', text: 'Brightest purple just below spot = danger zone. A break there triggers dealer selling that accelerates the drop.' },
  { icon: '↔️', text: 'Scan left→right: a strike that stays green across multiple expiries is a sticky, high-conviction support level.' },
  { icon: '⬛', text: 'Dark/empty cells = zero open interest at that strike/expiry. No gamma there, no gravitational pull on price.' },
];

const VEX_GUIDE = [
  { icon: '🟢', text: 'Green above spot + upcoming vol event = dealers will BUY when IV drops (vol crush rip). Even "meh" news can rip.' },
  { icon: '🟣', text: 'Purple below spot + vol spike = dealers will SELL when IV normalizes. Vol-crush can turn bullish into bearish.' },
  { icon: '📅', text: 'Focus on the nearest expiry column on event days (FOMC, CPI). That\'s where the vol crush hits hardest.' },
  { icon: '⬛', text: 'Dark/empty cells = zero open interest there. No vanna exposure, no vol-driven flow.' },
];

export function GexHeatmap({ profile }: { profile: GexProfile }) {
  const [mode, setMode] = useState<Mode>('gex');
  const [showGuide, setShowGuide] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const spotRowRef = useRef<HTMLTableRowElement>(null);

  // Scroll only this panel's scroll container; does not touch page scroll
  useEffect(() => {
    const container = tableContainerRef.current;
    const row = spotRowRef.current;
    if (!container || !row) return;
    const rr = row.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    container.scrollTop += rr.top - cr.top - cr.height / 2 + rr.height / 2;
  }, [profile.symbol, profile.spot, mode]);

  const hm = mode === 'gex' ? profile.heatmap : profile.vexHeatmap;
  const { expiries, strikes, values } = hm;
  if (!expiries.length) return <p className="text-xs text-muted">No heatmap data.</p>;

  const desc = [...strikes].sort((a, b) => b - a);
  const max = Math.max(1, ...values.flat().map(Math.abs));

  const spotStrike = desc.reduce((best, k) =>
    Math.abs(k - profile.spot) < Math.abs(best - profile.spot) ? k : best, desc[0]);

  const get = (ei: number, k: number) => values[ei][strikes.indexOf(k)] ?? 0;

  const guide = mode === 'gex' ? GEX_GUIDE : VEX_GUIDE;
  const tipKey = mode === 'gex' ? 'gexHeatmap' : 'vexHeatmap';

  return (
    <div className="space-y-2">
      {/* header bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
          LIVE
        </span>
        <span className="text-[10px] text-muted ml-1">
          {profile.symbol} · <span className="text-text font-medium">${profile.spot.toFixed(2)}</span>
        </span>

        {/* toggle */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowGuide(g => !g)}
            className="text-[10px] text-muted hover:text-accent border border-border rounded px-2 py-0.5"
          >
            {showGuide ? 'hide guide' : 'how to read'}
          </button>
          <InfoTip metric={tipKey} />
          <div className="flex rounded-md overflow-hidden border border-border">
            {(['gex', 'vex'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${mode === m ? 'bg-accent text-bg' : 'text-muted hover:text-text'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* trading guide */}
      {showGuide && (
        <div className="bg-panel2 rounded-md border border-border p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-text mb-2">
            {mode === 'gex' ? 'GEX heatmap — what to look for' : 'VEX heatmap — what to look for'}
          </p>
          {guide.map((g, i) => (
            <div key={i} className="flex gap-2 text-[11px]">
              <span className="shrink-0 text-sm leading-tight">{g.icon}</span>
              <span className="text-muted leading-snug">{g.text}</span>
            </div>
          ))}
          {mode === 'gex' && (
            <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted">
              <span className="text-up font-medium">Call wall</span> = strike with most green gamma above spot (labeled ▲) ·{' '}
              <span className="text-down font-medium">Put wall</span> = most purple below spot (labeled ▼) ·{' '}
              <span className="text-warn font-medium">Yellow row</span> = current price
            </div>
          )}
          {mode === 'vex' && (
            <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted">
              VEX = sensitivity to 1-vol-point IV move · computed from gamma via Black-Scholes · most useful on FOMC/CPI/earnings days
            </div>
          )}
        </div>
      )}

      {/* table */}
      <div ref={tableContainerRef} className="overflow-auto max-h-[460px] rounded-md border border-border">
        <table className="text-[11px] tabular w-full border-collapse" style={{ minWidth: `${expiries.length * 90 + 70}px` }}>
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th className="text-right pr-2 py-1.5 font-medium text-muted border-b border-border w-16">Strike</th>
              {expiries.map(e => (
                <th key={e} className="text-right pr-2 py-1.5 font-medium text-muted border-b border-border min-w-[80px]">
                  {e.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {desc.map(k => {
              const isSpot = k === spotStrike;
              const isCallWall = k === profile.callWall;
              const isPutWall = k === profile.putWall;
              return (
                <tr key={k} ref={isSpot ? spotRowRef : undefined} className={isSpot ? 'bg-warn/10' : ''}>
                  <td className={`text-right pr-2 py-1 border-b border-border/40 font-mono text-[10px] ${isSpot ? 'text-warn font-bold' : isCallWall ? 'text-up font-semibold' : isPutWall ? 'text-down font-semibold' : 'text-muted'}`}>
                    {k}
                    {isCallWall && <span className="ml-0.5">▲</span>}
                    {isPutWall && <span className="ml-0.5">▼</span>}
                  </td>
                  {expiries.map((e, ei) => {
                    const v = get(ei, k);
                    const style = cellStyle(v, max);
                    const showLabel = v !== 0 && Math.abs(v) / max >= LABEL_THRESHOLD;
                    return (
                      <td key={e}
                        title={v !== 0 ? `${k} @ ${e}: ${fmtCell(v)}` : `${k} @ ${e}: no open interest`}
                        className="text-right pr-2 py-1 border-b border-border/20 text-[10px]"
                        style={style}>
                        {showLabel ? fmtCell(v) : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted">
        <span><span className="text-emerald-400 font-medium">Green</span> = dealers long {mode === 'gex' ? 'gamma' : 'vanna'} — stabilizing</span>
        <span><span className="text-violet-400 font-medium">Purple</span> = dealers short — destabilizing / amplifies moves</span>
        <span><span className="text-warn font-medium">Yellow row</span> = current spot</span>
        <span>Dark cells = zero OI (no options traded there)</span>
        {mode === 'gex' && <span>▲ call wall · ▼ put wall · columns = expiry dates</span>}
        {mode === 'vex' && <span>Hover any cell for exact value · numbers shown when ≥8% of max</span>}
      </div>
    </div>
  );
}
