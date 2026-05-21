import { z } from 'zod';

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const UpdateProfileInput = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;
