'use client';
import { useState, type ReactNode } from 'react';
import { GLOSSARY } from '@/lib/insights/glossary';
import { fmtPct } from '@/lib/format';

export function Panel({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-panel border border-border rounded-lg ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function StaleBadge({ stale, asOf }: { stale?: boolean; asOf?: number }) {
  if (!asOf) return null;
  const time = new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <span className={`text-[10px] tabular ${stale ? 'text-warn' : 'text-muted'}`}>
      {stale ? `stale · ${time}` : time}
    </span>
  );
}

export function PriceChange({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`tabular ${value >= 0 ? 'text-up' : 'text-down'} ${className}`}>{fmtPct(value)}</span>
  );
}

/** ⓘ glossary popover. metric must be a GLOSSARY key. */
export function InfoTip({ metric }: { metric: string }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[metric];
  if (!entry) return null;
  return (
    <span className="relative inline-block">
      <button
        aria-label={`What is ${entry.term}?`}
        className="text-muted hover:text-accent text-[10px] border border-border rounded-full w-4 h-4 inline-flex items-center justify-center align-middle ml-1 cursor-help"
        onClick={() => setOpen(o => !o)} onBlur={() => setOpen(false)}
      >i</button>
      {open && (
        <span className="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-72 bg-panel2 border border-border rounded-lg p-3 text-xs shadow-xl block text-left normal-case font-normal tracking-normal">
          <span className="font-semibold text-text block mb-1">{entry.term}</span>
          <span className="text-muted block mb-2">{entry.short}</span>
          <span className="text-accent block">Why it matters: <span className="text-muted">{entry.why}</span></span>
        </span>
      )}
    </span>
  );
}

export function Spinner() {
  return <div className="text-muted text-xs animate-pulse p-4 text-center">loading…</div>;
}
