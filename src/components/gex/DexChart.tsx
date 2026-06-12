'use client';
import type { GexProfile } from '@/lib/types';

function fmtDex(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function DexChart({ profile }: { profile: GexProfile }) {
  const { dex, spot } = profile;
  if (!dex.length) return <p className="text-xs text-muted">No DEX data.</p>;

  const sorted = [...dex].sort((a, b) => b.strike - a.strike);
  const max = Math.max(1, ...sorted.map(r => Math.abs(r.netDex)));

  const spotStrike = sorted.reduce((best, r) =>
    Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best, sorted[0]).strike;

  // only show strikes within 5% range and non-trivial DEX
  const visible = sorted.filter(r =>
    Math.abs(r.strike - spot) / spot <= 0.05 &&
    (Math.abs(r.netDex) >= max * 0.03 || r.strike === spotStrike)
  );

  return (
    <div className="space-y-px max-h-[300px] overflow-y-auto">
      <p className="text-[10px] text-muted mb-1.5">
        Net dealer delta by strike. Positive = dealers long delta (will sell into rallies). Negative = dealers short delta (will buy dips).
      </p>
      {visible.map(r => {
        const pct = Math.abs(r.netDex) / max * 50;
        const pos = r.netDex >= 0;
        const isSpot = r.strike === spotStrike;
        return (
          <div key={r.strike} className={`flex items-center gap-2 text-[11px] rounded-sm px-1 ${isSpot ? 'bg-panel2 ring-1 ring-warn/30' : ''}`}>
            <span className={`w-16 tabular text-right shrink-0 ${isSpot ? 'text-warn font-bold' : 'text-muted'}`}>
              {r.strike}
            </span>
            <div className="flex-1 relative h-3.5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute inset-y-0.5 rounded-sm ${pos ? 'bg-sky-500/70' : 'bg-orange-400/70'}`}
                style={pos ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </div>
            <span className={`w-16 tabular text-right shrink-0 text-[10px] ${pos ? 'text-sky-400' : 'text-orange-400'}`}>
              {fmtDex(r.netDex)}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted pt-1.5">
        <span className="text-sky-400">Blue</span> = long delta (sell pressure on rips) ·{' '}
        <span className="text-orange-400">Orange</span> = short delta (buy pressure on dips)
      </p>
    </div>
  );
}
