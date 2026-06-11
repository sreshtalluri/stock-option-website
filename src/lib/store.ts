import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL'];

export function dataDir(): string {
  const dir = process.env.GAMMADESK_DATA_DIR ?? path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

export function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function watchlistFile(): string { return path.join(dataDir(), 'watchlist.json'); }

export function readWatchlist(): string[] {
  const list = readJson<string[] | null>(watchlistFile(), null);
  if (list && Array.isArray(list)) return list;
  writeJson(watchlistFile(), DEFAULT_WATCHLIST);
  return [...DEFAULT_WATCHLIST];
}

export function addSymbol(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  const list = readWatchlist();
  if (sym && !list.includes(sym)) list.push(sym);
  writeJson(watchlistFile(), list);
  return list;
}

export function removeSymbol(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  const list = readWatchlist().filter(s => s !== sym);
  writeJson(watchlistFile(), list);
  return list;
}
