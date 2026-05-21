export const EPOCH = '2020-01-01';
const MS_PER_DAY = 86_400_000;

export function parseDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function daysSinceEpoch(yyyymmdd: string): number {
  return Math.round((parseDate(yyyymmdd).getTime() - parseDate(EPOCH).getTime()) / MS_PER_DAY);
}

export function addDays(yyyymmdd: string, n: number): string {
  return formatDate(new Date(parseDate(yyyymmdd).getTime() + n * MS_PER_DAY));
}

export function daysBetween(a: string, b: string): number {
  return daysSinceEpoch(b) - daysSinceEpoch(a);
}

export function today(): string {
  return formatDate(new Date());
}

export type DateRange = { start: string; end: string };

export function computeInitialRange(
  tasks: { startDate: string; endDate: string }[],
  todayDate: string = today(),
): DateRange {
  if (tasks.length === 0) {
    return { start: addDays(todayDate, -30), end: addDays(todayDate, 90) };
  }
  let earliest = tasks[0]!.startDate;
  let latest = tasks[0]!.endDate;
  for (const t of tasks) {
    if (t.startDate < earliest) earliest = t.startDate;
    if (t.endDate > latest) latest = t.endDate;
  }
  const start = addDays(earliest < todayDate ? earliest : todayDate, -30);
  const end = addDays(latest > todayDate ? latest : todayDate, 90);
  return { start, end };
}

export function expandRangeIfNearEdge(
  range: DateRange,
  visibleStart: string,
  visibleEnd: string,
  thresholdDays = 30,
  extendDays = 90,
): DateRange {
  let { start, end } = range;
  if (daysBetween(start, visibleStart) < thresholdDays) start = addDays(start, -extendDays);
  if (daysBetween(visibleEnd, end) < thresholdDays) end = addDays(end, extendDays);
  return { start, end };
}

export type Zoom = 'day' | 'week' | 'month';

export function dayWidthFor(zoom: Zoom): number {
  return zoom === 'day' ? 40 : zoom === 'week' ? 8 : 3;
}
