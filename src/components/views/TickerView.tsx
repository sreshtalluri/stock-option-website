'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, NewsItem, QuoteLite } from '@/lib/types';
import { Panel, PriceChange, Spinner, StaleBadge, InfoTip } from '@/components/ui';
import { TradingViewChart } from '@/components/TradingViewChart';
import { GexProfileChart } from '@/components/gex/GexProfile';
import { fmtMoney, fmtNum } from '@/lib/format';

interface Ratings {
  consensus: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  meanRating: number | null; ratingKey: string | null;
  targetMean: number | null; targetHigh: number | null; targetLow: number | null;
  history: { firm: string; action: string; fromGrade: string; toGrade: string; date: string | null }[];
}
interface Stats {
  symbol: string; name: string; marketCap: number | null; peRatio: number | null; forwardPe: number | null;
  week52High: number | null; week52Low: number | null; avgVolume: number | null; beta: number | null;
  shortPctFloat: number | null; earningsDate: string | null;
}

function ConsensusBar({ c }: { c: NonNullable<Ratings['consensus']> }) {
  const total = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell || 1;
  const segs = [
    { n: c.strongBuy, color: '#3fb950', label: 'Strong buy' },
    { n: c.buy, color: '#7ee2a8', label: 'Buy' },
    { n: c.hold, color: '#d29922', label: 'Hold' },
    { n: c.sell, color: '#f0883e', label: 'Sell' },
    { n: c.strongSell, color: '#f85149', label: 'Strong sell' },
  ].filter(s => s.n > 0);
  return (
    <div>
      <div className="flex w-full gap-px mb-1 rounded-full overflow-hidden">
        {segs.map(s => (
          <div key={s.label} title={`${s.label}: ${s.n}`} style={{ width: `${s.n / total * 100}%`, background: s.color }} className="h-2" />
        ))}
      </div>
      <p className="text-[10px] text-muted">{c.strongBuy + c.buy} buy · {c.hold} hold · {c.sell + c.strongSell} sell</p>
    </div>
  );
}

export function TickerView({ symbol }: { symbol: string }) {
  const quote = usePolling<QuoteLite[]>(`/api/quotes?symbols=${symbol}`, 15_000);
  const stats = usePolling<Stats>(`/api/stats/${symbol}`, 900_000);
  const ratings = usePolling<Ratings>(`/api/ratings/${symbol}`, 900_000);
  const news = usePolling<NewsItem[]>(`/api/news?symbols=${symbol}`, 60_000);
  const gex = usePolling<{ profile: GexProfile; insights: Insight[] }>(`/api/gex/${symbol}`, 300_000);

  const q = quote.data?.[0];
  const s = stats.data;
  const r = ratings.data;

  const statRows: { label: string; value: string }[] = s ? [
    { label: 'Market cap', value: s.marketCap ? fmtMoney(s.marketCap) : '—' },
    { label: 'P/E (ttm)', value: s.peRatio ? s.peRatio.toFixed(1) : '—' },
    { label: '52w range', value: s.week52Low && s.week52High ? `${s.week52Low.toFixed(2)} – ${s.week52High.toFixed(2)}` : '—' },
    { label: 'Avg volume', value: s.avgVolume ? fmtNum(s.avgVolume) : '—' },
    { label: 'Beta', value: s.beta ? s.beta.toFixed(2) : '—' },
    { label: 'Short % float', value: s.shortPctFloat ? `${(s.shortPctFloat * 100).toFixed(1)}%` : '—' },
    { label: 'Next earnings', value: s.earningsDate ?? '—' },
  ] : [];

  return (
    <div className="p-3 space-y-3 overflow-y-auto">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{symbol}</h2>
        {s?.name && <span className="text-sm text-muted">{s.name}</span>}
        {q && <>
          <span className="text-xl tabular font-semibold">{q.price.toFixed(2)}</span>
          <PriceChange value={q.changePct} className="text-sm" />
          {q.dayLow != null && q.dayHigh != null && (
            <span className="text-xs text-muted tabular">{q.dayLow.toFixed(2)} – {q.dayHigh.toFixed(2)} day range</span>
          )}
        </>}
        <span className="ml-auto"><StaleBadge stale={quote.stale} asOf={quote.asOf} /></span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Panel className="xl:col-span-2" title="Chart (TradingView — realtime with your login)">
          <div className="h-[420px]"><TradingViewChart symbol={symbol} /></div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Analyst ratings">
            {ratings.loading ? <Spinner /> : r?.consensus ? (
              <div className="space-y-3">
                <ConsensusBar c={r.consensus} />
                {r.targetMean && q && q.price > 0 && (
                  <p className="text-xs text-muted">
                    Avg target <span className="text-text tabular font-semibold">{r.targetMean.toFixed(2)}</span>
                    {' '}({((r.targetMean / q.price - 1) * 100).toFixed(1)}% vs spot) · range {r.targetLow?.toFixed(0)}–{r.targetHigh?.toFixed(0)}
                  </p>
                )}
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {r.history.map((h, i) => (
                    <p key={i} className="text-[11px] text-muted">
                      <span className={h.action === 'up' ? 'text-up' : h.action === 'down' ? 'text-down' : ''}>
                        {h.action === 'up' ? '▲' : h.action === 'down' ? '▼' : '•'}
                      </span>{' '}
                      <span className="text-text">{h.firm}</span> {h.fromGrade ? `${h.fromGrade} → ` : ''}{h.toGrade} <span>{h.date ?? ''}</span>
                    </p>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-muted">No analyst coverage found.</p>}
          </Panel>

          <Panel title="Key stats">
            {stats.loading ? <Spinner /> : (
              <table className="w-full text-xs">
                <tbody>
                  {statRows.map(row => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="py-1 text-muted">{row.label}</td>
                      <td className="py-1 text-right tabular">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel className="xl:col-span-2" title={`News — ${symbol}`}>
          {news.loading ? <Spinner /> : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {news.data?.map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 rounded hover:bg-panel2">
                  <p className="text-xs">{n.title}</p>
                  <p className="text-[10px] text-muted">{n.source} · {new Date(n.publishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </a>
              ))}
              {!news.data?.length && <p className="text-xs text-muted">No recent news.</p>}
            </div>
          )}
        </Panel>

        <Panel title={<>GEX profile<InfoTip metric="gex" /></>}>
          {gex.error ? <p className="text-xs text-muted">No listed options for {symbol}.</p>
            : gex.loading ? <Spinner />
            : gex.data ? <GexProfileChart profile={gex.data.profile} /> : null}
        </Panel>
      </div>
    </div>
  );
}
