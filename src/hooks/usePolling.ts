'use client';
import { useEffect, useRef, useState } from 'react';

export interface PollState<T> { data?: T; asOf?: number; stale?: boolean; error?: string; loading: boolean; }

/** Polls an API route returning the Cached<T> envelope ({value, asOf, stale}). url=null pauses. */
export function usePolling<T>(url: string | null, intervalMs: number): PollState<T> {
  const [state, setState] = useState<PollState<T>>({ loading: true });
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    if (!url) { setState({ loading: false }); return; }
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(url);
        const body = await res.json();
        if (!active || urlRef.current !== url) return;
        if (!res.ok) { setState(s => ({ ...s, error: body.error ?? `HTTP ${res.status}`, loading: false })); return; }
        setState({ data: body.value as T, asOf: body.asOf, stale: body.stale, loading: false });
      } catch (err) {
        if (active) setState(s => ({ ...s, error: String(err), loading: false }));
      }
    };
    setState(s => ({ ...s, error: undefined, loading: s.data === undefined }));
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [url, intervalMs]);

  return state;
}
