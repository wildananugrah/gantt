import { addDays, daysBetween, parseDate, type DateRange, type Zoom } from '../../lib/date';

export function GridLayer({ range, dayWidth, zoom, height }: { range: DateRange; dayWidth: number; zoom: Zoom; height: number }) {
  const totalDays = daysBetween(range.start, range.end);
  const lines: { left: number; strong: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(range.start, i);
    const d = parseDate(iso);
    let strong = false;
    if (zoom === 'day') strong = d.getUTCDay() === 1;
    else if (zoom === 'week') strong = d.getUTCDate() === 1;
    else strong = d.getUTCDate() === 1 && d.getUTCMonth() === 0;
    lines.push({ left: i * dayWidth, strong });
  }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{ left: l.left, height }}
          className={`absolute top-0 w-px ${l.strong ? 'bg-rule' : 'bg-rule/30'}`}
        />
      ))}
    </div>
  );
}
