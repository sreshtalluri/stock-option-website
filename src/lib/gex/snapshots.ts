import path from 'node:path';
import fs from 'node:fs';
import type { GexSnapshot } from '@/lib/types';
import { dataDir, writeJson } from '@/lib/store';

const MAX_AGE_MS = 7 * 86_400_000;

function file(): string { return path.join(dataDir(), 'gex-snapshots.json'); }

function readAll(): GexSnapshot[] {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')) as GexSnapshot[]; } catch { return []; }
}

export function appendSnapshot(snap: GexSnapshot): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  const all = readAll().filter(s => s.ts >= cutoff);
  all.push(snap);
  writeJson(file(), all);
}

export function readSnapshots(symbol: string): GexSnapshot[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return readAll().filter(s => s.symbol === symbol && s.ts >= cutoff).sort((a, b) => a.ts - b.ts);
}
