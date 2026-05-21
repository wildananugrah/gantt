import { z } from 'zod';
import { User } from './user';

export const Project = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof Project>;

export const ProjectWithMembers = Project.extend({
  members: z.array(User),
});
export type ProjectWithMembers = z.infer<typeof ProjectWithMembers>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;
