# Move task to another project — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to move an existing task to another project, with hard blocks when the move would break invariants (dependencies, PIC not in destination, or insufficient permissions).

**Architecture:**
- Server: new `POST /api/tasks/:id/move` endpoint. The pre-flight decision logic (dependency check, PIC membership, requester permission, target-project sameness) is extracted to a pure helper `validateMoveTask` in `lib/move-task.ts` that takes injected lookup callbacks — mirrors the existing `lib/cycle-check.ts` pattern and is unit-testable without a database.
- Client: a small `MoveTaskSection` component is rendered inside `TaskDetailPanel`, between the task form and the dependency picker. It calls the new endpoint and maps response error codes to specific inline messages.
- Shared: new `MoveTaskInput` Zod schema.
- Tests: pure unit tests for the validator (matching the existing repo convention of testing libs, not HTTP routes or components). Route-level and UI behaviour are verified manually after build.

**Tech Stack:** Bun, Hono, Drizzle ORM, Postgres, Zod, React 18, TanStack Query, Vitest, Bun test.

**Reference spec:** [`docs/superpowers/specs/2026-05-29-move-task-between-projects-design.md`](../specs/2026-05-29-move-task-between-projects-design.md)

---

## File Map

**Create:**
- `packages/server/src/lib/move-task.ts` — pure `validateMoveTask` decision helper.
- `packages/server/src/lib/move-task.test.ts` — unit tests for the helper.
- `packages/client/src/components/task-panel/MoveTaskSection.tsx` — UI for selecting a destination project and submitting the move.

**Modify:**
- `packages/shared/src/task.ts` — add `MoveTaskInput` schema + type.
- `packages/server/src/routes/tasks.ts` — add `.post('/:id/move', ...)` handler on `taskRoutes`.
- `packages/client/src/components/task-panel/TaskDetailPanel.tsx` — render `<MoveTaskSection>` between `TaskForm` and `DependencyPicker`.

No schema migration, no changes to the router mount points (the new endpoint is already covered by `app.route('/api/tasks', taskRoutes)` in `packages/server/src/app.ts`).

---

## Task 1: Add `MoveTaskInput` schema to shared

**Files:**
- Modify: `packages/shared/src/task.ts`

This is exported automatically via `packages/shared/src/index.ts` which already re-exports everything from `./task`. No change to the index file needed.

- [ ] **Step 1: Append the schema to `packages/shared/src/task.ts`**

Append at the end of the file (after the existing `UpdateTaskInput` export):

```ts
export const MoveTaskInput = z.object({
  targetProjectId: z.string().uuid(),
});
export type MoveTaskInput = z.infer<typeof MoveTaskInput>;
```

- [ ] **Step 2: Typecheck the shared package**

Run: `bun run --filter='@app/shared' typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/task.ts
git commit -m "feat(shared): MoveTaskInput schema for move-task endpoint"
```

---

## Task 2: Pure validator helper — failing test first

**Files:**
- Create: `packages/server/src/lib/move-task.test.ts`
- Create: `packages/server/src/lib/move-task.ts` (stub only in this task)

The validator is a pure function that takes the inputs it needs (current task, target project, requester, dependency count, PIC membership lookup result) and returns a discriminated union `{ ok: true } | { ok: false, status, code, message }`. Following the `lib/cycle-check.ts` style: callbacks for lookups so tests don't need a DB.

- [ ] **Step 1: Write the failing test file**

Create `packages/server/src/lib/move-task.test.ts`:

```ts
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
```

- [ ] **Step 2: Create a stub `move-task.ts` so the import resolves but tests fail**

Create `packages/server/src/lib/move-task.ts`:

```ts
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

export function validateMoveTask(_input: ValidateMoveTaskInput): ValidateMoveTaskResult {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `bun test packages/server/src/lib/move-task.test.ts`
Expected: all 9 cases fail with "not implemented".

---

## Task 3: Implement the validator

**Files:**
- Modify: `packages/server/src/lib/move-task.ts`

The validation order matters — earlier checks have priority. The test in Task 2 step 1 already pins that "same-project beats has-deps".

- [ ] **Step 1: Replace the stub body with the real implementation**

Replace the `validateMoveTask` function body in `packages/server/src/lib/move-task.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and watch them pass**

Run: `bun test packages/server/src/lib/move-task.test.ts`
Expected: all 9 cases pass.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/lib/move-task.ts packages/server/src/lib/move-task.test.ts
git commit -m "feat(server): validateMoveTask pure decision helper + tests"
```

---

## Task 4: Wire the move route

**Files:**
- Modify: `packages/server/src/routes/tasks.ts`

The new handler is attached to the existing `taskRoutes` chain (which is already mounted at `/api/tasks` in `app.ts`). Path: `POST /:id/move`.

The handler:
1. Loads the task; 404 if missing.
2. Enforces source-side access (admin OR member of source — same as existing PATCH does via `assertProjectMember`).
3. Loads destination existence, requester membership in destination, dependency count, PIC membership in destination — these are the inputs to `validateMoveTask`.
4. Calls `validateMoveTask`; if not ok, throws an `HttpError` carrying the helper's `status` / `code` / `message`.
5. In a single transaction: computes `max(sort_order)` in destination, updates `tasks.project_id`, `tasks.sort_order = max+1` (or 0 if destination empty), `tasks.updated_at = now()`. Returns the updated row.

- [ ] **Step 1: Add imports at the top of `packages/server/src/routes/tasks.ts`**

In the imports block (currently lines 1–12), make these additions:

- On the `@app/shared` import line (currently `import { CreateTaskInput, UpdateTaskInput } from '@app/shared';`), add `MoveTaskInput`:

  ```ts
  import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from '@app/shared';
  ```

- On the schema import (currently `import { tasks, taskDependencies, taskFiles } from '../db/schema';`), add `projects` and `projectMembers`:

  ```ts
  import { tasks, taskDependencies, taskFiles, projects, projectMembers } from '../db/schema';
  ```

- Add a new import below the membership import:

  ```ts
  import { validateMoveTask } from '../lib/move-task';
  ```

- Add `or` to the existing drizzle-orm import (currently `import { and, eq, inArray, sql } from 'drizzle-orm';`):

  ```ts
  import { and, eq, inArray, or, sql } from 'drizzle-orm';
  ```

- [ ] **Step 2: Append the `.post('/:id/move', ...)` handler to `taskRoutes`**

In `packages/server/src/routes/tasks.ts`, the current `taskRoutes` chain ends at the `.delete('/:id', ...)` handler (line 114–122). Insert a new `.post('/:id/move', ...)` between `.patch('/:id', ...)` and `.delete('/:id', ...)` so the chain stays grouped by id-targeted routes. Add it like this (full handler below, replacing nothing — it's a new chain step):

```ts
  .post('/:id/move', async (c) => {
    const id = c.req.param('id');
    const body = await parseBody(c, MoveTaskInput);
    const me = c.get('user');

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');

    // Source-side access: same rule as PATCH.
    if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);

    // Gather inputs for the validator.
    const [destProject] = await db.select({ id: projects.id })
      .from(projects).where(eq(projects.id, body.targetProjectId)).limit(1);

    const [requesterInDest] = await db.select({ uid: projectMembers.userId })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, body.targetProjectId),
        eq(projectMembers.userId, me.id),
      )).limit(1);

    const depsRows = await db.select({ p: taskDependencies.predecessorId })
      .from(taskDependencies)
      .where(or(
        eq(taskDependencies.predecessorId, id),
        eq(taskDependencies.successorId, id),
      )).limit(1);

    let picInDest = true;
    if (existing.picUserId) {
      const [picRow] = await db.select({ uid: projectMembers.userId })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, body.targetProjectId),
          eq(projectMembers.userId, existing.picUserId),
        )).limit(1);
      picInDest = !!picRow;
    }

    const decision = validateMoveTask({
      task: { id: existing.id, projectId: existing.projectId, picUserId: existing.picUserId },
      targetProjectId: body.targetProjectId,
      requester: { id: me.id, role: me.role },
      destinationExists: !!destProject,
      requesterInDestination: !!requesterInDest,
      dependencyCount: depsRows.length,
      picInDestination: picInDest,
    });
    if (!decision.ok) throw new HttpError(decision.status, decision.code, decision.message);

    const updated = await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ m: sql<number | null>`max(${tasks.sortOrder})` })
        .from(tasks)
        .where(eq(tasks.projectId, body.targetProjectId));
      const nextSort = (maxRow?.m ?? -1) + 1;
      const [t] = await tx.update(tasks).set({
        projectId: body.targetProjectId,
        sortOrder: nextSort,
        updatedAt: sql`now()` as any,
      }).where(eq(tasks.id, id)).returning();
      return t;
    });
    return c.json(updated);
  })
```

The final chain order will be: `.get('/:id', …)` → `.patch('/:id', …)` → `.post('/:id/move', …)` → `.delete('/:id', …)`.

- [ ] **Step 3: Typecheck the server**

Run: `bun run --filter='@app/server' typecheck`
Expected: no errors.

- [ ] **Step 4: Unit tests still pass**

Run: `bun test packages/server/src/lib/move-task.test.ts`
Expected: still 9 passing.

- [ ] **Step 5: Quick manual smoke (server only)**

Start the server: `bun run --filter='@app/server' dev` (in another shell if not already running).

In a third shell, hit the endpoint with cookies from a logged-in session — easiest is to copy a `Cookie:` header from your browser's devtools. Then:

```bash
# Replace with real ids
TASK_ID=...
TARGET=...
curl -i -X POST "http://localhost:3000/api/tasks/$TASK_ID/move" \
  -H 'content-type: application/json' \
  -H "Cookie: <copied from browser>" \
  -d "{\"targetProjectId\":\"$TARGET\"}"
```

Expected for happy path: `HTTP/1.1 200` and a JSON task object with the new `projectId`. Expected for a task with deps: `HTTP/1.1 409` and `{"error":{"code":"HAS_DEPENDENCIES",...}}`.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/tasks.ts
git commit -m "feat(server): POST /api/tasks/:id/move endpoint"
```

---

## Task 5: `MoveTaskSection` client component

**Files:**
- Create: `packages/client/src/components/task-panel/MoveTaskSection.tsx`

This component is self-contained: it fetches projects, renders a select + Move button, calls the endpoint, maps errors to inline messages, and on success invalidates the relevant queries and resets the route search.

- [ ] **Step 1: Create the component**

Create `packages/client/src/components/task-panel/MoveTaskSection.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, Task } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Button } from '../ui/Button';

export function MoveTaskSection({
  task,
  dependencyCount,
}: {
  task: Pick<Task, 'id' | 'projectId'>;
  dependencyCount: number;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [targetId, setTargetId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  });

  const choices = (projectsQ.data ?? [])
    .filter((p) => p.id !== task.projectId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const move = useMutation({
    mutationFn: (targetProjectId: string) =>
      api.post<Task>(`/tasks/${task.id}/move`, { targetProjectId }),
    onSuccess: (updated) => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', updated.projectId] });
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      nav({ to: '.', search: {}, replace: true });
    },
    onError: (err) => {
      if (!(err instanceof ApiException)) {
        setError('Move failed.');
        return;
      }
      switch (err.code) {
        case 'HAS_DEPENDENCIES':
          setError(
            `This task has ${dependencyCount} dependenc${dependencyCount === 1 ? 'y' : 'ies'}. ` +
            `Remove them in Depends on before moving.`,
          );
          break;
        case 'PIC_NOT_IN_DESTINATION':
          setError('PIC is not a member of the selected project. Unassign the PIC or add them to that project first.');
          break;
        case 'FORBIDDEN':
          setError("You're not a member of that project.");
          break;
        case 'NOT_FOUND':
          setError('That project no longer exists.');
          break;
        default:
          setError(`Move failed: ${err.message}`);
      }
    },
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Move to project</h3>
      {projectsQ.isLoading ? (
        <div className="text-muted text-[13px]">Loading projects…</div>
      ) : choices.length === 0 ? (
        <div className="text-muted text-[13px]">No other projects available.</div>
      ) : (
        <div className="flex gap-2 items-start">
          <select
            value={targetId}
            onChange={(e) => { setTargetId(e.target.value); setError(null); }}
            className="flex-1 h-9 px-2 border border-rule rounded bg-paper text-[13px]"
            disabled={move.isPending}
          >
            <option value="">choose a project…</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => targetId && move.mutate(targetId)}
            disabled={!targetId || move.isPending}
          >
            {move.isPending ? 'Moving…' : 'Move'}
          </Button>
        </div>
      )}
      {error && (
        <div className="text-[12px] text-red-600 leading-snug">{error}</div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck the client**

Run: `bun run --filter='@app/client' typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/task-panel/MoveTaskSection.tsx
git commit -m "feat(client): MoveTaskSection component for cross-project task move"
```

---

## Task 6: Render `MoveTaskSection` in `TaskDetailPanel`

**Files:**
- Modify: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`

- [ ] **Step 1: Add the import**

Add to the imports block (after the existing `import { TaskComments } from './TaskComments';`):

```tsx
import { MoveTaskSection } from './MoveTaskSection';
```

- [ ] **Step 2: Render the section between `TaskForm` and `DependencyPicker`**

In the JSX, the current order inside the `<>` after the loading guard is:

```
<TaskForm … />
<DependencyPicker … />
<section>…Whiteboard…</section>
<FileUploader … />
<TaskComments … />
```

Insert `<MoveTaskSection>` between `<TaskForm>` and `<DependencyPicker>`:

```tsx
<TaskForm
  task={data}
  projectMembers={projectMembers}
  onDeleted={() => nav({ to: '.', search: {}, replace: true })}
/>
<MoveTaskSection
  task={data}
  dependencyCount={data.dependencies.length}
/>
<DependencyPicker
  task={data}
  allTasks={allTasks}
  dependencies={data.dependencies}
  onPredecessorClick={(p) => nav({ to: '.', search: { task: p.id }, replace: true })}
/>
```

- [ ] **Step 3: Typecheck the client**

Run: `bun run --filter='@app/client' typecheck`
Expected: no errors.

- [ ] **Step 4: Manual UI verification**

Start the app: `bun run --filter='@app/server' dev &` and `bun run --filter='@app/client' dev`.
Open `http://localhost:5173`, log in, open a project with at least two projects you can access. Open a task in the side panel and verify each scenario:

1. **Happy path** — task with no dependencies and no PIC (or PIC who is a member of the destination): select a destination, click Move. Panel closes (route search cleared). Source project list no longer shows the task; switching to the destination shows it at the bottom.
2. **Has dependencies** — pick a task with at least one predecessor or successor. Click Move. Inline message: "This task has N dependencies. Remove them in Depends on before moving." Task does not move.
3. **PIC not in destination** — pick a task with a PIC who isn't a member of the destination. Inline message: "PIC is not a member of the selected project…". Task does not move.
4. **No other projects** — log in as a user with access to only one project. Section reads "No other projects available."
5. **Dropdown filter** — current project is not in the dropdown.

- [ ] **Step 5: Run the full test suites**

Run: `bun test`
Expected: all server + client tests pass (the new `move-task.test.ts` cases included).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/task-panel/TaskDetailPanel.tsx
git commit -m "feat(client): mount MoveTaskSection in task detail panel"
```

---

## Wrap-up checklist

- [ ] All 6 tasks committed.
- [ ] `bun test` green.
- [ ] Typecheck green on shared, server, client.
- [ ] All 5 manual UI scenarios in Task 6 Step 4 verified.
