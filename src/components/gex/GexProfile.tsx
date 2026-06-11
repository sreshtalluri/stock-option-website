'use client';
import type { GexProfile as Profile } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

export function GexProfileChart({ profile }: { profile: Profile }) {
  const rows = [...profile.byStrike].sort((a, b) => b.strike - a.strike);
  if (!rows.length) return <p className="text-xs text-muted">No strikes in range.</p>;
  const max = Math.max(1, ...rows.map(r => Math.abs(r.netGex)));
  const nearest = (target: number | null) =>
    target === null ? null : rows.reduce((best, r) => Math.abs(r.strike - target) < Math.abs(best.strike - target) ? r : best, rows[0]).strike;
  const spotRow = nearest(profile.spot);
  const flipRow = nearest(profile.flipPoint);

  return (
    <div className="space-y-px max-h-[520px] overflow-y-auto">
      {rows.map(r => {
        const pct = Math.abs(r.netGex) / max * 50; // % of half-width
        const pos = r.netGex >= 0;
        return (
          <div key={r.strike} className={`flex items-center gap-2 text-[11px] rounded-sm px-1 ${r.strike === spotRow ? 'bg-panel2 ring-1 ring-accent/40' : ''}`}>
            <span className={`w-16 tabular text-right shrink-0 ${r.strike === profile.callWall ? 'text-up font-bold' : r.strike === profile.putWall ? 'text-down font-bold' : 'text-muted'}`}>
              {r.strike}
              {r.strike === profile.callWall ? ' ⊕' : r.strike === profile.putWall ? ' ⊖' : ''}
            </span>
            <div className="flex-1 relative h-3.5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              {flipRow === r.strike && <div className="absolute left-0 right-0 border-t border-dashed border-warn top-1/2" />}
              <div
                className={`absolute inset-y-0.5 rounded-sm ${pos ? 'bg-up/70' : 'bg-down/70'}`}
                style={pos ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </div>
            <span className="w-16 tabular text-right text-muted shrink-0">{fmtMoney(r.netGex)}</span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted pt-2">
        ⊕ call wall · ⊖ put wall · highlighted row ≈ spot ({profile.spot.toFixed(2)}) · dashed = flip {profile.flipPoint ? `(${profile.flipPoint.toFixed(1)})` : '(n/a)'}
      </p>
    </div>
  );
}
