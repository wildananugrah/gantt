import { addDays, daysBetween, parseDate, type DateRange, type Zoom } from '../../lib/date';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function DateHeader({ range, dayWidth, zoom }: { range: DateRange; dayWidth: number; zoom: Zoom }) {
  const totalDays = daysBetween(range.start, range.end);
  const dayCells: { iso: string; dow: number; day: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(range.start, i);
    const d = parseDate(iso);
    dayCells.push({ iso, dow: d.getUTCDay(), day: d.getUTCDate() });
  }

  const months: { label: string; left: number; width: number }[] = [];
  let i = 0;
  while (i < dayCells.length) {
    const start = dayCells[i]!;
    const d = parseDate(start.iso);
    const ym = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let j = i;
    while (j < dayCells.length) {
      const d2 = parseDate(dayCells[j]!.iso);
      if (`${d2.getUTCFullYear()}-${d2.getUTCMonth()}` !== ym) break;
      j++;
    }
    months.push({
      label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      left: i * dayWidth,
      width: (j - i) * dayWidth,
    });
    i = j;
  }

  return (
    <div className="select-none">
      <div className="relative h-6 border-b border-rule">
        {months.map((m) => (
          <div
            key={m.left}
            style={{ left: m.left, width: m.width }}
            className="absolute top-0 h-6 text-[11px] text-muted flex items-center pl-2 border-r border-rule"
          >
            {m.label}
          </div>
        ))}
      </div>
      <div className="relative h-6">
        {dayCells.map((c, idx) => {
          const showLabel = zoom === 'day' || (zoom === 'week' && c.dow === 1) || (zoom === 'month' && c.day === 1);
          return (
            <div
              key={c.iso}
              style={{ left: idx * dayWidth, width: dayWidth }}
              className={`absolute top-0 h-6 text-[10px] text-muted flex items-center justify-center ${
                c.dow === 0 || c.dow === 6 ? 'bg-mist/50' : ''
              }`}
            >
              {showLabel ? c.day : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
