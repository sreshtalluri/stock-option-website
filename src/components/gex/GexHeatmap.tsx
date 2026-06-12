'use client';
import { useState } from 'react';
import type { GexProfile } from '@/lib/types';

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
  if (v === 0 || max === 0) return { background: 'transparent' };
  const intensity = Math.min(Math.abs(v) / max, 1);
  const alpha = intensity * 0.82 + 0.08;
  if (v > 0) {
    // green: rgb(52, 211, 153)
    return { background: `rgba(52,211,153,${alpha})`, color: intensity > 0.5 ? '#0a0e14' : '#e6edf3' };
  }
  // purple: rgb(167, 139, 250)
  return { background: `rgba(139,92,246,${alpha})`, color: intensity > 0.5 ? '#e6edf3' : '#c4b5fd' };
}

export function GexHeatmap({ profile }: { profile: GexProfile }) {
  const [mode, setMode] = useState<Mode>('gex');

  const hm = mode === 'gex' ? profile.heatmap : profile.vexHeatmap;
  const { expiries, strikes, values } = hm;
  if (!expiries.length) return <p className="text-xs text-muted">No heatmap data.</p>;

  const desc = [...strikes].sort((a, b) => b - a);
  const max = Math.max(1, ...values.flat().map(Math.abs));

  const spotStrike = desc.reduce((best, k) => Math.abs(k - profile.spot) < Math.abs(best - profile.spot) ? k : best, desc[0]);
  const get = (ei: number, k: number) => values[ei][strikes.indexOf(k)] ?? 0;

  return (
    <div className="space-y-2">
      {/* header bar */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-up animate-pulse" />
          LIVE
        </span>
        <span className="text-[10px] text-muted ml-1">{profile.symbol} · <span className="text-text">${profile.spot.toFixed(2)}</span></span>
        <div className="ml-auto flex rounded-md overflow-hidden border border-border">
          {(['gex', 'vex'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${mode === m ? 'bg-accent text-bg' : 'text-muted hover:text-text'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="overflow-auto max-h-[460px] rounded-md border border-border">
        <table className="text-[11px] tabular w-full border-collapse" style={{ minWidth: `${expiries.length * 90 + 70}px` }}>
          <thead className="sticky top-0 z-10 bg-panel">
            <tr>
              <th className="text-right pr-2 py-1.5 font-medium text-muted border-b border-border w-16">Strike</th>
              {expiries.map(e => (
                <th key={e} className="text-right pr-2 py-1.5 font-medium text-muted border-b border-border">
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
                <tr key={k} className={isSpot ? 'bg-warn/10' : ''}>
                  <td className={`text-right pr-2 py-1 border-b border-border/40 font-mono ${isSpot ? 'text-warn font-bold' : isCallWall ? 'text-up font-semibold' : isPutWall ? 'text-down font-semibold' : 'text-muted'}`}>
                    {k}
                    {isCallWall && <span className="ml-0.5 text-[9px]">▲</span>}
                    {isPutWall && <span className="ml-0.5 text-[9px]">▼</span>}
                  </td>
                  {expiries.map((e, ei) => {
                    const v = get(ei, k);
                    const style = cellStyle(v, max);
                    const showLabel = Math.abs(v) / max > 0.2;
                    return (
                      <td key={e} title={`${k} @ ${e}: ${fmtCell(v)}`}
                        className="text-right pr-2 py-1 border-b border-border/20"
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

      <p className="text-[10px] text-muted">
        <span className="text-emerald-400">Green</span> = dealers long {mode === 'gex' ? 'gamma' : 'vanna'} (stabilizing) ·{' '}
        <span className="text-violet-400">Purple</span> = dealers short (destabilizing) ·{' '}
        <span className="text-warn">Yellow row</span> = spot ·{' '}
        {mode === 'gex' ? '▲ call wall · ▼ put wall' : 'VEX = dealer delta sensitivity to IV moves (1 vol-pt)'}
      </p>
    </div>
  );
}
