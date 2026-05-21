import { daysBetween, today, type DateRange } from '../../lib/date';

export function TodayLine({ range, dayWidth, height }: { range: DateRange; dayWidth: number; height: number }) {
  const todayIso = today();
  if (todayIso < range.start || todayIso > range.end) return null;
  const left = daysBetween(range.start, todayIso) * dayWidth + dayWidth / 2;
  return (
    <div
      className="absolute top-0 w-px bg-focus/60 pointer-events-none"
      style={{ left, height }}
    />
  );
}
