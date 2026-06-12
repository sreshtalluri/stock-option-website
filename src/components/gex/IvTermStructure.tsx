'use client';
import { useState } from 'react';
import type { GexProfile } from '@/lib/types';

export function IvTermStructure({ profile }: { profile: GexProfile }) {
  const [showGuide, setShowGuide] = useState(false);
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

  const isBackwardation = pts[0].atmIv > pts[pts.length - 1].atmIv;
  const color = isBackwardation ? 'var(--color-warn)' : 'var(--color-up)';
  const fillColor = isBackwardation ? 'rgba(210,153,34,0.12)' : 'rgba(63,185,80,0.10)';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBackwardation ? 'bg-warn/15 text-warn' : 'bg-up/15 text-up'}`}>
          {isBackwardation ? 'Backwardation' : 'Contango'}
        </span>
        <span className="text-[10px] text-muted flex-1">
          {isBackwardation
            ? 'Near-term IV elevated — event risk or stress priced in'
            : 'Normal term structure — calm, low-stress tape'}
        </span>
        <button
          onClick={() => setShowGuide(g => !g)}
          className="text-[10px] text-muted hover:text-accent border border-border rounded px-2 py-0.5"
        >
          {showGuide ? 'hide' : 'what this means'}
        </button>
      </div>

      {showGuide && (
        <div className="bg-panel2 rounded-md border border-border p-3 space-y-1.5 text-[11px]">
          <p className="font-semibold text-text mb-1">IV Term Structure — what to look for</p>
          <div className="flex gap-2">
            <span className="shrink-0 text-up font-bold">Contango</span>
            <span className="text-muted">Near IV {'<'} far IV — normal, healthy market. Sell premium normally, size up, be patient. No event is scaring the near-term options market.</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 text-warn font-bold">Backwardation</span>
            <span className="text-muted">Near IV {'>'} far IV — the market fears something soon (earnings, FOMC, CPI, geopolitical). Buying near-term options is expensive. Selling them pays but carries event risk. The bigger the inversion, the more fear is priced in.</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0">⚡</span>
            <span className="text-muted">After the event, IV crushes sharply — near-term IV collapses back toward far-term. Long options lose premium value even when direction is right. Strategies that benefit: debit spreads (defined cost), iron condors after event, or just wait for crush to pass before entering.</span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0">👀</span>
            <span className="text-muted">Watch for a sudden SHIFT from contango to backwardation — it often precedes a vol spike by hours. If this flips to backwardation and you don't see an obvious event, something may be developing.</span>
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }}>
        {[minIv, (minIv + maxIv) / 2, maxIv].map((v, i) => (
          <g key={i}>
            <text x={PAD.l - 3} y={y(v) + 3} fontSize={7} textAnchor="end" fill="var(--color-muted)">
              {(v * 100).toFixed(0)}%
            </text>
            <line x1={PAD.l} x2={PAD.l + iW} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={0.5} />
          </g>
        ))}
        <path d={fill} fill={fillColor} />
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.atmIv)} r={2.5} fill={color}><title>{`${p.expiry}: ${(p.atmIv * 100).toFixed(1)}% IV`}</title></circle>
            <text x={x(i)} y={H - 4} fontSize={7} textAnchor="middle" fill="var(--color-muted)">
              {p.expiry.slice(5)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-muted">
        ATM implied vol per expiry · {isBackwardation ? 'Backwardation = near-term fear/event' : 'Contango = normal calm market'} · hover dots for exact %
      </p>
    </div>
  );
}
