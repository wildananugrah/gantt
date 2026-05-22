import { z } from 'zod';

export const TaskComment = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  edited: z.boolean(),
});
export type TaskComment = z.infer<typeof TaskComment>;

export const CreateCommentInput = z.object({
  body: z.string().min(1).max(5000),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const UpdateCommentInput = z.object({
  body: z.string().min(1).max(5000),
});
export type UpdateCommentInput = z.infer<typeof UpdateCommentInput>;
