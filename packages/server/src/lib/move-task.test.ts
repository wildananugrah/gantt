import { describe, it, expect } from 'bun:test';
import { validateMoveTask } from './move-task';

type Inputs = Parameters<typeof validateMoveTask>[0];

const base = (overrides: Partial<Inputs> = {}): Inputs => ({
  task: { id: 't1', projectId: 'pA', picUserId: null },
  targetProjectId: 'pB',
  requester: { id: 'u1', role: 'member' },
  destinationExists: true,
  requesterInDestination: true,
  dependencyCount: 0,
  picInDestination: true,
  ...overrides,
});

describe('validateMoveTask', () => {
  it('accepts a clean move', () => {
    expect(validateMoveTask(base())).toEqual({ ok: true });
  });

  it('rejects when target equals current project (VALIDATION_ERROR, 400)', () => {
    const r = validateMoveTask(base({ targetProjectId: 'pA' }));
    expect(r).toEqual({
      ok: false, status: 400, code: 'VALIDATION_ERROR',
      message: 'target project is the same as the current project',
    });
  });

  it('rejects when destination project does not exist (NOT_FOUND, 404)', () => {
    const r = validateMoveTask(base({ destinationExists: false }));
    expect(r).toMatchObject({ ok: false, status: 404, code: 'NOT_FOUND' });
  });

  it('rejects a non-admin requester not in destination (FORBIDDEN, 403)', () => {
    const r = validateMoveTask(base({ requesterInDestination: false }));
    expect(r).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('allows an admin requester even when not in destination', () => {
    const r = validateMoveTask(base({
      requester: { id: 'u1', role: 'admin' },
      requesterInDestination: false,
    }));
    expect(r).toEqual({ ok: true });
  });

  it('rejects when the task has any dependencies (HAS_DEPENDENCIES, 409)', () => {
    const r = validateMoveTask(base({ dependencyCount: 1 }));
    expect(r).toMatchObject({ ok: false, status: 409, code: 'HAS_DEPENDENCIES' });
  });

  it('rejects when the PIC is not a member of the destination (PIC_NOT_IN_DESTINATION, 409)', () => {
    const r = validateMoveTask(base({
      task: { id: 't1', projectId: 'pA', picUserId: 'pic1' },
      picInDestination: false,
    }));
    expect(r).toMatchObject({ ok: false, status: 409, code: 'PIC_NOT_IN_DESTINATION' });
  });

  it('ignores picInDestination when picUserId is null', () => {
    const r = validateMoveTask(base({
      task: { id: 't1', projectId: 'pA', picUserId: null },
      picInDestination: false,
    }));
    expect(r).toEqual({ ok: true });
  });

  it('reports the highest-priority error first: same-project beats has-deps', () => {
    const r = validateMoveTask(base({ targetProjectId: 'pA', dependencyCount: 5 }));
    expect(r).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
