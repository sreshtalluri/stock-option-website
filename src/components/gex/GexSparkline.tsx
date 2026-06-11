'use client';
import type { GexSnapshot } from '@/lib/types';
import { fmtMoney } from '@/lib/format';

export function GexSparkline({ snapshots }: { snapshots: GexSnapshot[] }) {
  if (snapshots.length < 2) return <p className="text-xs text-muted">Collecting snapshots — history appears after a few refresh cycles during market hours.</p>;
  const w = 280, h = 60, pad = 4;
  const vals = snapshots.map(s => s.totalGex);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + i / (snapshots.length - 1) * (w - 2 * pad);
  const y = (v: number) => h - pad - (v - min) / span * (h - 2 * pad);
  const points = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  const last = vals[vals.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        {zeroY !== null && <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="var(--color-border)" strokeDasharray="3 3" />}
        <polyline points={points} fill="none" stroke={last >= 0 ? 'var(--color-up)' : 'var(--color-down)'} strokeWidth="1.5" />
      </svg>
      <p className="text-[10px] text-muted">Total net GEX over recent sessions · latest {fmtMoney(last)}</p>
    </div>
  );
}
