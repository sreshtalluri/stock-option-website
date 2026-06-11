export function isMarketOpen(d: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const minutes = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60; // 9:30–16:00 ET; holidays not modeled
}
