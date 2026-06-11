'use client';
import { usePolling } from '@/hooks/usePolling';
import type { GexProfile, Insight, NewsItem } from '@/lib/types';
import { InfoTip, Spinner, StaleBadge } from '@/components/ui';

const SEV_STYLE: Record<Insight['severity'], string> = {
  info: 'border-l-accent', watch: 'border-l-warn', alert: 'border-l-down',
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function RightRail() {
  const news = usePolling<NewsItem[]>('/api/news', 60_000);
  const market = usePolling<Insight[]>('/api/insights', 300_000);
  const spy = usePolling<{ profile: GexProfile; insights: Insight[] }>('/api/gex/SPY', 300_000);

  const insights = [...(spy.data?.insights ?? []), ...(market.data ?? [])];

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-panel flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Insights</h3>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '45%' }}>
        {insights.length === 0 && <Spinner />}
        {insights.map(i => (
          <div key={i.id} className={`bg-panel2 border border-border border-l-2 ${SEV_STYLE[i.severity]} rounded-md p-2.5`}>
            <p className="text-xs font-semibold mb-1">{i.title}{i.metric && <InfoTip metric={i.metric} />}</p>
            <p className="text-xs text-muted leading-relaxed">{i.body}</p>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-y border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Live News</h3>
        <StaleBadge stale={news.stale} asOf={news.asOf} />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {news.loading && <Spinner />}
        {news.data?.map(n => (
          <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 rounded hover:bg-panel2">
            <p className="text-xs leading-snug">{n.title}</p>
            <p className="text-[10px] text-muted mt-0.5">
              {n.symbols?.length ? <span className="text-accent mr-1.5">{n.symbols.join(' ')}</span> : null}
              {n.source} · {timeAgo(n.publishedAt)} ago
            </p>
          </a>
        ))}
        {!news.loading && !news.data?.length && <p className="text-xs text-muted p-2">No news available.</p>}
      </div>
    </aside>
  );
}
