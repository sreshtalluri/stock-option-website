export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}$${trim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

export function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}%`;
}

export function fmtNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${trim(v / 1e9)}B`;
  if (a >= 1e6) return `${trim(v / 1e6)}M`;
  if (a >= 1e3) return `${trim(v / 1e3)}K`;
  return String(v);
}

function trim(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}
