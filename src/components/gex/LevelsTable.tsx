'use client';
import type { GexProfile } from '@/lib/types';
import { InfoTip } from '@/components/ui';
import { fmtMoney } from '@/lib/format';

export function LevelsTable({ profile }: { profile: GexProfile }) {
  const rows: { label: string; metric: string; value: string; cls?: string }[] = [
    { label: 'Spot', metric: 'regime', value: profile.spot.toFixed(2) },
    { label: 'Total net GEX', metric: 'gex', value: fmtMoney(profile.totalGex), cls: profile.totalGex >= 0 ? 'text-up' : 'text-down' },
    { label: 'Zero-gamma flip', metric: 'flip', value: profile.flipPoint ? profile.flipPoint.toFixed(1) : 'n/a', cls: 'text-warn' },
    { label: 'Call wall', metric: 'callWall', value: profile.callWall ? String(profile.callWall) : 'n/a', cls: 'text-up' },
    { label: 'Put wall', metric: 'putWall', value: profile.putWall ? String(profile.putWall) : 'n/a', cls: 'text-down' },
  ];
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(r => (
          <tr key={r.label} className="border-b border-border last:border-0">
            <td className="py-1.5 text-muted">{r.label}<InfoTip metric={r.metric} /></td>
            <td className={`py-1.5 text-right tabular font-semibold ${r.cls ?? ''}`}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
