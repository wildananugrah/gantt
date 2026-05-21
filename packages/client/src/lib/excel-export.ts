import ExcelJS from 'exceljs';
import type { Task, User } from '@app/shared';
import { addDays, daysBetween, parseDate, type Zoom } from './date';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Bucket = { iso: string; label: string; monthLabel: string };

function buildBuckets(startIso: string, endIso: string, zoom: Zoom): Bucket[] {
  const buckets: Bucket[] = [];
  if (zoom === 'day') {
    const totalDays = daysBetween(startIso, endIso) + 1;
    for (let i = 0; i < totalDays; i++) {
      const iso = addDays(startIso, i);
      const d = parseDate(iso);
      buckets.push({
        iso,
        label: String(d.getUTCDate()),
        monthLabel: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      });
    }
    return buckets;
  }
  if (zoom === 'week') {
    // Align bucket starts to Monday on or before startIso
    let cursor = parseDate(startIso);
    const dow = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    cursor = parseDate(addDays(startIso, -(dow - 1)));
    const endD = parseDate(endIso);
    while (cursor.getTime() <= endD.getTime()) {
      const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
      buckets.push({
        iso,
        label: `wk ${String(cursor.getUTCDate()).padStart(2, '0')}`,
        monthLabel: `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
      });
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    }
    return buckets;
  }
  // month
  let cursor = parseDate(startIso);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const endD = parseDate(endIso);
  while (cursor.getTime() <= endD.getTime()) {
    const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-01`;
    buckets.push({
      iso,
      label: MONTHS[cursor.getUTCMonth()]!,
      monthLabel: String(cursor.getUTCFullYear()),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return buckets;
}

function bucketIndexForDate(buckets: Bucket[], iso: string, zoom: Zoom): number {
  if (zoom === 'day') return daysBetween(buckets[0]!.iso, iso);
  if (zoom === 'week') return Math.floor(daysBetween(buckets[0]!.iso, iso) / 7);
  // month
  const d = parseDate(iso);
  const first = parseDate(buckets[0]!.iso);
  return (d.getUTCFullYear() - first.getUTCFullYear()) * 12 + (d.getUTCMonth() - first.getUTCMonth());
}

const FIXED_HEADERS = ['Ticket', 'Task', 'PIC', 'Start', 'End', 'Days', 'Status'];

type StatusStyle = {
  fill: string;       // ARGB
  font: string;       // ARGB
  strikethrough?: boolean;
  pattern?: 'lightHorizontal' | 'lightUp';
};
const STATUS: Record<Task['status'], StatusStyle> = {
  todo:        { fill: 'FFFFFFFF', font: 'FF111111' },
  in_progress: { fill: 'FF111111', font: 'FFFFFFFF' },
  done:        { fill: 'FFE5E5E5', font: 'FF888888', strikethrough: true, pattern: 'lightUp' },
};

const RULE_COLOR = 'FFE5E5E5';
const MUTED_COLOR = 'FF888888';

export async function exportGanttToExcel(args: {
  projectName: string;
  tasks: Task[];
  members: User[];
  zoom: Zoom;
}): Promise<void> {
  const { projectName, tasks, members, zoom } = args;

  if (tasks.length === 0) {
    alert('No tasks to export.');
    return;
  }

  // Compute date range from tasks
  let earliest = tasks[0]!.startDate;
  let latest = tasks[0]!.endDate;
  for (const t of tasks) {
    if (t.startDate < earliest) earliest = t.startDate;
    if (t.endDate > latest) latest = t.endDate;
  }
  const buckets = buildBuckets(earliest, latest, zoom);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gantt Task Manager';
  wb.created = new Date();
  const ws = wb.addWorksheet('Gantt', {
    views: [{ state: 'frozen', xSplit: FIXED_HEADERS.length, ySplit: 2 }],
  });

  // ---- Header rows ----
  // Row 1: month bands across timeline; fixed-column headers span both rows.
  // Row 2: bucket labels (day numbers / week start / months); fixed headers repeat in row 1 merged.

  // Fixed headers (rows 1-2 merged)
  FIXED_HEADERS.forEach((label, i) => {
    const col = i + 1;
    ws.mergeCells(1, col, 2, col);
    const cell = ws.getCell(1, col);
    cell.value = label;
    cell.font = { bold: true, size: 11, color: { argb: 'FF111111' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: RULE_COLOR } },
      right:  { style: 'thin', color: { argb: RULE_COLOR } },
    };
  });

  // Timeline headers
  // Group consecutive buckets sharing monthLabel and merge row 1
  const tlStart = FIXED_HEADERS.length + 1;
  let i = 0;
  while (i < buckets.length) {
    const group = buckets[i]!.monthLabel;
    let j = i;
    while (j < buckets.length && buckets[j]!.monthLabel === group) j++;
    const fromCol = tlStart + i;
    const toCol = tlStart + j - 1;
    if (fromCol !== toCol) ws.mergeCells(1, fromCol, 1, toCol);
    const c = ws.getCell(1, fromCol);
    c.value = group;
    c.font = { bold: true, size: 10, color: { argb: MUTED_COLOR } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    c.border = {
      bottom: { style: 'thin', color: { argb: RULE_COLOR } },
      right:  { style: 'thin', color: { argb: RULE_COLOR } },
    };
    i = j;
  }
  buckets.forEach((b, idx) => {
    const col = tlStart + idx;
    const c = ws.getCell(2, col);
    c.value = b.label;
    c.font = { size: 9, color: { argb: MUTED_COLOR } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
    c.border = {
      bottom: { style: 'thin', color: { argb: RULE_COLOR } },
      right:  { style: 'thin', color: { argb: RULE_COLOR } },
    };
  });

  // ---- Column widths ----
  const fixedWidths = [13, 32, 18, 12, 12, 6, 14];
  fixedWidths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });
  const cellWidth = zoom === 'day' ? 3 : zoom === 'week' ? 6 : 10;
  for (let k = 0; k < buckets.length; k++) {
    ws.getColumn(tlStart + k).width = cellWidth;
  }

  // ---- Row heights ----
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 16;

  // ---- Task rows ----
  const memberById = new Map(members.map((m) => [m.id, m]));
  const sorted = [...tasks].sort((a, b) =>
    a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate),
  );

  sorted.forEach((t, rowIdx) => {
    const r = 3 + rowIdx;
    const row = ws.getRow(r);
    row.height = 22;

    const pic = t.picUserId ? memberById.get(t.picUserId) : undefined;
    const days = daysBetween(t.startDate, t.endDate) + 1;

    row.getCell(1).value = t.ticketNumber;
    row.getCell(2).value = t.title;
    row.getCell(3).value = pic?.name ?? '';
    row.getCell(4).value = t.startDate;
    row.getCell(5).value = t.endDate;
    row.getCell(6).value = days;
    row.getCell(7).value = t.status === 'in_progress' ? 'In Progress'
      : t.status.charAt(0).toUpperCase() + t.status.slice(1);

    for (let c = 1; c <= FIXED_HEADERS.length; c++) {
      const cell = row.getCell(c);
      cell.font = { size: 11, color: { argb: 'FF111111' } };
      cell.alignment = { vertical: 'middle', horizontal: c === 6 ? 'right' : 'left' };
      cell.border = {
        bottom: { style: 'hair', color: { argb: RULE_COLOR } },
        right:  { style: 'hair', color: { argb: RULE_COLOR } },
      };
      if (c === 1) {
        cell.font = { size: 10, color: { argb: MUTED_COLOR }, name: 'Menlo' };
      } else if (t.status === 'done') {
        cell.font = { size: 11, color: { argb: MUTED_COLOR }, strike: true };
      }
    }

    // Bar cells across timeline
    const fromIdx = Math.max(0, bucketIndexForDate(buckets, t.startDate, zoom));
    const toIdx = Math.min(buckets.length - 1, bucketIndexForDate(buckets, t.endDate, zoom));
    const style = STATUS[t.status];

    for (let k = fromIdx; k <= toIdx; k++) {
      const cell = row.getCell(tlStart + k);
      cell.fill = {
        type: 'pattern',
        pattern: style.pattern ?? 'solid',
        fgColor: { argb: style.fill },
        bgColor: { argb: style.pattern ? 'FFFFFFFF' : style.fill },
      };
      if (t.status === 'todo') {
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FF111111' } },
          bottom: { style: 'thin', color: { argb: 'FF111111' } },
          left:   k === fromIdx ? { style: 'thin', color: { argb: 'FF111111' } } : undefined,
          right:  k === toIdx   ? { style: 'thin', color: { argb: 'FF111111' } } : undefined,
        };
      }
    }

    // Title text inside the first bar cell when bar width allows it
    if (zoom === 'day' && toIdx - fromIdx >= 4) {
      const c = row.getCell(tlStart + fromIdx);
      c.value = t.title;
      c.font = { size: 10, color: { argb: style.font }, strike: style.strikethrough };
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  });

  // ---- Save ----
  const buf = await wb.xlsx.writeBuffer();
  const safeName = projectName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'gantt';
  const todayIso = new Date().toISOString().slice(0, 10);
  const filename = `${safeName}-${todayIso}.xlsx`;

  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
