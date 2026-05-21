import { z } from 'zod';

export const TaskStatus = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof TaskStatus>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const Task = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: dateStr,
  endDate: dateStr,
  status: TaskStatus,
  picUserId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof Task>;

export const Dependency = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
});
export type Dependency = z.infer<typeof Dependency>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: dateStr,
  endDate: dateStr,
  status: TaskStatus.default('todo'),
  picUserId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).refine((v) => v.startDate <= v.endDate, {
  path: ['endDate'],
  message: 'endDate must be on or after startDate',
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
  status: TaskStatus.optional(),
  picUserId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).refine(
  (v) => !(v.startDate && v.endDate) || v.startDate <= v.endDate,
  { path: ['endDate'], message: 'endDate must be on or after startDate' },
).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;
