'use client';
import type { GexProfile } from '@/lib/types';

export function IvTermStructure({ profile }: { profile: GexProfile }) {
  const { ivTermStructure: pts } = profile;
  if (pts.length < 2) return <p className="text-xs text-muted">Need 2+ expiries for vol term structure.</p>;

  const minIv = Math.min(...pts.map(p => p.atmIv));
  const maxIv = Math.max(...pts.map(p => p.atmIv));
  const range = maxIv - minIv || 0.01;
  const W = 280, H = 90, PAD = { l: 28, r: 8, t: 8, b: 24 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const x = (i: number) => PAD.l + (i / (pts.length - 1)) * iW;
  const y = (iv: number) => PAD.t + iH - ((iv - minIv) / range) * iH;

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.atmIv).toFixed(1)}`).join(' ');
  const fill = `${path} L${x(pts.length - 1).toFixed(1)},${(PAD.t + iH).toFixed(1)} L${PAD.l.toFixed(1)},${(PAD.t + iH).toFixed(1)} Z`;

  // backwardation = nearer term IV > far term IV
  const isBackwardation = pts[0].atmIv > pts[pts.length - 1].atmIv;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBackwardation ? 'bg-warn/15 text-warn' : 'bg-up/15 text-up'}`}>
          {isBackwardation ? 'Backwardation' : 'Contango'}
        </span>
        <span className="text-[10px] text-muted">
          {isBackwardation ? 'Near-term IV elevated — stress or event risk' : 'Normal term structure — calm tape'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }}>
        {/* y-axis labels */}
        {[minIv, (minIv + maxIv) / 2, maxIv].map((v, i) => (
          <text key={i} x={PAD.l - 3} y={y(v) + 3} fontSize={7} textAnchor="end" fill="var(--color-muted)">
            {(v * 100).toFixed(0)}%
          </text>
        ))}
        {/* grid */}
        {[minIv, (minIv + maxIv) / 2, maxIv].map((v, i) => (
          <line key={i} x1={PAD.l} x2={PAD.l + iW} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={0.5} />
        ))}
        {/* fill */}
        <path d={fill} fill={isBackwardation ? 'rgba(210,153,34,0.12)' : 'rgba(63,185,80,0.10)'} />
        {/* line */}
        <path d={path} fill="none" stroke={isBackwardation ? 'var(--color-warn)' : 'var(--color-up)'} strokeWidth={1.5} />
        {/* dots + x labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.atmIv)} r={2.5} fill={isBackwardation ? 'var(--color-warn)' : 'var(--color-up)'} />
            <text x={x(i)} y={H - 4} fontSize={7} textAnchor="middle" fill="var(--color-muted)">
              {p.expiry.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-muted">ATM implied vol per expiry. Backwardation = near-term stress; contango = normal calm.</p>
    </div>
  );
}
