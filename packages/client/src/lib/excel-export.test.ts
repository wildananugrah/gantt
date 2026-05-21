import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task, User } from '@app/shared';

// Mock the DOM bits the export touches (anchor click, URL.createObjectURL).
beforeEach(() => {
  const calls: any = { clicked: false };
  (calls as any).blob = null;
  (URL as any).createObjectURL = vi.fn((b: Blob) => {
    (calls as any).blob = b;
    return 'blob:fake';
  });
  (URL as any).revokeObjectURL = vi.fn();
  // capture anchor.click without navigating
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'a') (el as HTMLAnchorElement).click = () => { (calls as any).clicked = true; };
    return el;
  });
  (globalThis as any).__exportCalls = calls;
});

const member: User = {
  id: '00000000-0000-0000-0000-000000000aaa',
  email: 'a@a.com', name: 'Alice Lee', role: 'member', createdAt: '2026-01-01T00:00:00Z',
};

const tasks: Task[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    projectId: 'p',
    title: 'Design',
    description: null, startDate: '2026-05-20', endDate: '2026-05-22',
    status: 'in_progress', picUserId: member.id, sortOrder: 0,
    createdAt: '', updatedAt: '',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    projectId: 'p',
    title: 'Build',
    description: null, startDate: '2026-05-23', endDate: '2026-05-30',
    status: 'todo', picUserId: null, sortOrder: 1,
    createdAt: '', updatedAt: '',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    projectId: 'p',
    title: 'Launch',
    description: null, startDate: '2026-05-29', endDate: '2026-05-31',
    status: 'done', picUserId: null, sortOrder: 2,
    createdAt: '', updatedAt: '',
  },
];

describe('exportGanttToExcel', () => {
  it('produces a non-empty xlsx blob for day zoom', async () => {
    const { exportGanttToExcel } = await import('./excel-export');
    await exportGanttToExcel({ projectName: 'Test Project', tasks, members: [member], zoom: 'day' });
    const calls = (globalThis as any).__exportCalls;
    expect(calls.clicked).toBe(true);
    expect(calls.blob).toBeInstanceOf(Blob);
    expect((calls.blob as Blob).size).toBeGreaterThan(2000);
  });

  it('produces a non-empty xlsx blob for week zoom', async () => {
    const { exportGanttToExcel } = await import('./excel-export');
    await exportGanttToExcel({ projectName: 'Test Project', tasks, members: [member], zoom: 'week' });
    const calls = (globalThis as any).__exportCalls;
    expect((calls.blob as Blob).size).toBeGreaterThan(2000);
  });

  it('produces a non-empty xlsx blob for month zoom', async () => {
    const { exportGanttToExcel } = await import('./excel-export');
    await exportGanttToExcel({ projectName: 'Test Project', tasks, members: [member], zoom: 'month' });
    const calls = (globalThis as any).__exportCalls;
    expect((calls.blob as Blob).size).toBeGreaterThan(2000);
  });
});
