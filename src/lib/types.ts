export interface QuoteLite {
  symbol: string; name?: string; price: number; change: number; changePct: number;
  dayHigh?: number; dayLow?: number; volume?: number; marketState?: string;
}
export interface OptionContract {
  type: 'call' | 'put'; strike: number; expiry: string; // YYYY-MM-DD
  gamma: number; iv: number; openInterest: number; volume: number;
}
export interface OptionsChain { symbol: string; spot: number; asOf: string; contracts: OptionContract[]; }
export interface GexByStrike { strike: number; netGex: number; callGex: number; putGex: number; }
export interface DexByStrike { strike: number; netDex: number; }
export interface IvPoint { expiry: string; atmIv: number; }
export interface GexProfile {
  symbol: string; spot: number; asOf: string; totalGex: number;
  flipPoint: number | null; callWall: number | null; putWall: number | null;
  byStrike: GexByStrike[];
  heatmap: { expiries: string[]; strikes: number[]; values: number[][] }; // values[expiryIdx][strikeIdx]
  vexHeatmap: { expiries: string[]; strikes: number[]; values: number[][] }; // Vanna Exposure
  dex: DexByStrike[]; // Delta Exposure by strike
  ivTermStructure: IvPoint[]; // ATM IV per expiry
}
export interface NewsItem { id: string; title: string; source: string; url: string; publishedAt: string; symbols?: string[]; }
export interface Insight { id: string; severity: 'info' | 'watch' | 'alert'; title: string; body: string; metric?: string; }
export interface GexSnapshot { ts: number; symbol: string; totalGex: number; flip: number | null; spot: number; }
export interface EconEvent {
  id: string; title: string; date: string; // ISO with offset
  impact: 'high' | 'medium' | 'low';
  forecast?: string; previous?: string;
  source: 'feed' | 'fomc-schedule';
}
