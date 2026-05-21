import { z } from 'zod';

export const Role = z.enum(['admin', 'member']);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: Role,
  createdAt: z.string(),
});
export type User = z.infer<typeof User>;

export const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: Role,
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(120).optional(),
  role: Role.optional(),
  password: z.string().min(8).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;
