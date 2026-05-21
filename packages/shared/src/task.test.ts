import { describe, it, expect } from 'bun:test';
import { CreateTaskInput, TaskStatus } from './task';

describe('CreateTaskInput', () => {
  it('rejects end_date before start_date', () => {
    const res = CreateTaskInput.safeParse({
      title: 'x',
      startDate: '2026-05-20',
      endDate: '2026-05-19',
    });
    expect(res.success).toBe(false);
  });

  it('accepts valid input with defaults', () => {
    const res = CreateTaskInput.safeParse({
      title: 'x',
      startDate: '2026-05-20',
      endDate: '2026-05-21',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.status).toBe('todo');
  });

  it('TaskStatus enum has exactly three values', () => {
    expect(TaskStatus.options).toEqual(['todo', 'in_progress', 'done']);
  });
});
