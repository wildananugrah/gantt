import { z } from 'zod';

export const TaskFile = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  filename: z.string(),
  s3Key: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.string(),
});
export type TaskFile = z.infer<typeof TaskFile>;

export const PresignUploadInput = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});
export type PresignUploadInput = z.infer<typeof PresignUploadInput>;

export const PresignUploadResult = z.object({
  uploadUrl: z.string().url(),
  s3Key: z.string(),
  expiresAt: z.string(),
});
export type PresignUploadResult = z.infer<typeof PresignUploadResult>;

export const ConfirmUploadInput = z.object({
  filename: z.string().min(1).max(255),
  s3Key: z.string().min(1),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInput>;
