export type ValidateMoveTaskInput = {
  task: { id: string; projectId: string; picUserId: string | null };
  targetProjectId: string;
  requester: { id: string; role: 'admin' | 'member' };
  destinationExists: boolean;
  requesterInDestination: boolean;
  dependencyCount: number;
  picInDestination: boolean;
};

export type ValidateMoveTaskResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message: string };

export function validateMoveTask(input: ValidateMoveTaskInput): ValidateMoveTaskResult {
  if (input.targetProjectId === input.task.projectId) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR',
      message: 'target project is the same as the current project' };
  }
  if (!input.destinationExists) {
    return { ok: false, status: 404, code: 'NOT_FOUND',
      message: 'target project not found' };
  }
  if (input.requester.role !== 'admin' && !input.requesterInDestination) {
    return { ok: false, status: 403, code: 'FORBIDDEN',
      message: 'you are not a member of the target project' };
  }
  if (input.dependencyCount > 0) {
    return { ok: false, status: 409, code: 'HAS_DEPENDENCIES',
      message: 'task has dependencies; remove them before moving' };
  }
  if (input.task.picUserId && !input.picInDestination) {
    return { ok: false, status: 409, code: 'PIC_NOT_IN_DESTINATION',
      message: 'PIC is not a member of the target project' };
  }
  return { ok: true };
}
