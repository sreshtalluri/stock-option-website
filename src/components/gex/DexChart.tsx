'use client';
import { useState } from 'react';
import type { GexProfile } from '@/lib/types';

function fmtDex(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M Δ`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K Δ`;
  return `${sign}${abs.toFixed(0)} Δ`;
}

export function DexChart({ profile }: { profile: GexProfile }) {
  const [showGuide, setShowGuide] = useState(false);
  const { dex, spot } = profile;
  if (!dex.length) return <p className="text-xs text-muted">No DEX data.</p>;

  const sorted = [...dex].sort((a, b) => b.strike - a.strike);
  const max = Math.max(1, ...sorted.map(r => Math.abs(r.netDex)));

  const spotStrike = sorted.reduce((best, r) =>
    Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best, sorted[0]).strike;

  const visible = sorted.filter(r =>
    Math.abs(r.strike - spot) / spot <= 0.05 &&
    (Math.abs(r.netDex) >= max * 0.03 || r.strike === spotStrike)
  );

  return (
    <div className="space-y-2">
      {/* guide toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted leading-snug">
          Net dealer delta by strike (±5% of spot). Positive = dealers long delta; negative = dealers short delta.
        </p>
        <button
          onClick={() => setShowGuide(g => !g)}
          className="text-[10px] text-muted hover:text-accent border border-border rounded px-2 py-0.5 ml-2 shrink-0"
        >
          {showGuide ? 'hide' : 'how to use'}
        </button>
      </div>

      {showGuide && (
        <div className="bg-panel2 rounded-md border border-border p-3 space-y-1.5 text-[11px]">
          <p className="font-semibold text-text mb-1">DEX — what to look for</p>
          <div className="flex gap-2">
            <span className="shrink-0 text-sky-400 font-bold">Blue →</span>
            <span className="text-muted">Dealers are net LONG delta above this strike. As price rallies into it, they sell to stay neutral. This creates natural resistance — a ceiling of sell pressure. The bigger the bar, the stronger the ceiling.</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 text-orange-400 font-bold">← Orange</span>
            <span className="text-muted">Dealers are net SHORT delta below this strike. As price falls into it, they buy to stay neutral. This creates natural support — a floor of buy pressure. The bigger the bar, the stronger the cushion.</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0">⚡</span>
            <span className="text-muted">When price moves THROUGH a heavy DEX level, the flow reverses sharply. An orange floor that breaks can flip to a wall of selling (dealers stop buying). Watch for volume spikes at these levels.</span>
          </div>
          <p className="text-[10px] text-muted/70 pt-1 border-t border-border">DEX = dealer net delta approximated from Black-Scholes N(d₁). 5% range shown.</p>
        </div>
      )}

      <div className="space-y-px max-h-[300px] overflow-y-auto">
        {visible.map(r => {
          const pct = Math.abs(r.netDex) / max * 50;
          const pos = r.netDex >= 0;
          const isSpot = r.strike === spotStrike;
          return (
            <div key={r.strike} className={`flex items-center gap-2 text-[11px] rounded-sm px-1 ${isSpot ? 'bg-panel2 ring-1 ring-warn/30' : ''}`}>
              <span className={`w-16 tabular text-right shrink-0 font-mono text-[10px] ${isSpot ? 'text-warn font-bold' : 'text-muted'}`}>
                {r.strike}
              </span>
              <div className="flex-1 relative h-3.5">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div
                  className={`absolute inset-y-0.5 rounded-sm ${pos ? 'bg-sky-500/70' : 'bg-orange-400/70'}`}
                  style={pos ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                />
              </div>
              <span className={`w-20 tabular text-right shrink-0 text-[10px] ${pos ? 'text-sky-400' : 'text-orange-400'}`}>
                {fmtDex(r.netDex)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 text-[10px] text-muted">
        <span><span className="text-sky-400 font-medium">Blue →</span> dealers long delta (sell pressure on rips)</span>
        <span><span className="text-orange-400 font-medium">← Orange</span> dealers short delta (buy pressure on dips)</span>
      </div>
    </div>
  );
}
