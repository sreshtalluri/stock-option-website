'use client';
import type { GexProfile } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

function cellColor(v: number, max: number): string {
  if (v === 0) return 'transparent';
  const a = Math.min(Math.abs(v) / max, 1) * 0.85 + 0.06;
  return v > 0 ? `rgba(63,185,80,${a})` : `rgba(248,81,73,${a})`;
}

export function GexHeatmap({ profile }: { profile: GexProfile }) {
  const { expiries, strikes, values } = profile.heatmap;
  if (!expiries.length) return <p className="text-xs text-muted">No heatmap data.</p>;
  const desc = [...strikes].sort((a, b) => b - a);
  const max = Math.max(1, ...values.flat().map(Math.abs));
  const get = (e: number, k: number) => values[e][strikes.indexOf(k)] ?? 0;

  return (
    <div className="overflow-auto max-h-[480px]">
      <table className="text-[10px] tabular border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-muted text-right pr-1 font-normal sticky left-0 bg-panel">strike</th>
            {expiries.map(e => <th key={e} className="text-muted font-normal px-1">{e.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {desc.map(k => (
            <tr key={k}>
              <td className={`text-right pr-1 sticky left-0 bg-panel ${k === profile.callWall ? 'text-up font-bold' : k === profile.putWall ? 'text-down font-bold' : 'text-muted'}`}>{k}</td>
              {expiries.map((e, ei) => {
                const v = get(ei, k);
                return (
                  <td key={e} title={`${k} @ ${e}: ${fmtMoney(v)}`}
                    className="min-w-9 h-5 text-center rounded-sm text-text/90"
                    style={{ background: cellColor(v, max) }}>
                    {Math.abs(v) / max > 0.35 ? fmtMoney(v).replace('$', '') : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted mt-1.5">Green = positive net gamma (stabilizing) · Red = negative (destabilizing) · columns are expiries (MM-DD)</p>
    </div>
  );
}
