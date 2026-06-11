'use client';
import { useEffect, useRef } from 'react';

export function TradingViewChart({ symbol }: { symbol: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: '15',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#10151d',
      gridColor: '#1e2735',
      hide_top_toolbar: false,
      allow_symbol_change: false,
      studies: ['STD;VWAP'],
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);
    return () => { el.innerHTML = ''; };
  }, [symbol]);

  return <div ref={ref} className="tradingview-widget-container h-full w-full" />;
}
