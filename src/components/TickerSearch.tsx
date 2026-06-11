'use client';
import { useEffect, useRef, useState } from 'react';

interface Result { symbol: string; name: string; exch: string; }

export function TickerSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 1) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        const body = await res.json();
        setResults(body.value ?? []);
        setOpen(true);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const pick = (symbol: string) => { onSelect(symbol); setQ(''); setOpen(false); };

  return (
    <div className="relative">
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter' && q.trim()) pick(q.trim().toUpperCase()); }}
        placeholder="Search ticker…"
        className="bg-panel2 border border-border rounded-md px-3 py-1.5 text-sm w-56 outline-none focus:border-accent placeholder:text-muted"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-9 right-0 w-72 bg-panel2 border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map(r => (
            <li key={r.symbol}>
              <button onMouseDown={() => pick(r.symbol)} className="w-full text-left px-3 py-2 hover:bg-panel flex justify-between gap-2 text-sm">
                <span className="font-semibold">{r.symbol}</span>
                <span className="text-muted truncate">{r.name}</span>
                <span className="text-muted text-xs shrink-0">{r.exch}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
