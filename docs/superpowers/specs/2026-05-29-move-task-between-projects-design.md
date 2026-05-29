# Move task to another project

Status: Draft (2026-05-29)

## Problem

A task currently belongs to one project for its entire lifetime. Users have no way to relocate a task if it was created in the wrong project or its scope shifts. They must recreate the task in the destination project and lose its ticket number, comments, files, and whiteboard.

## Goal

Allow a user to move an existing task into another project they have access to, preserving the task's identity (ticket number, files, comments, whiteboard, description, dates, status) and any side effects that would break invariants are surfaced as blocking errors rather than silent data loss.

## Non-goals

- Moving multiple tasks at once (bulk move).
- Cross-project dependencies.
- Migrating project members along with the task.
- Copy/duplicate to another project (this is move only).

## User flow

1. User opens a task in the side panel.
2. In the task panel, below the existing Save/Delete row, a new section **Move to project** shows a `<select>` of candidate destination projects and a **Move** button.
3. The user picks a destination and clicks **Move**.
4. Server validates and either performs the move (panel refreshes; task now belongs to destination) or returns a blocking error which the UI surfaces as an inline message in the Move section.

Blocking conditions and their messages:

- Task has dependencies (predecessor or successor) → "This task has N dependencies. Remove them in **Depends on** before moving."
- Task has a PIC who is not a member of the destination project → "PIC *<name>* is not a member of *<destination>*. Add them to the project or unassign the PIC before moving."
- User is not a member of the destination project (admins are exempt) → not selectable in the dropdown in the first place; defense-in-depth on the server returns 403.

## Permission model

- **Admin**: can move any task to any project.
- **Member**: can move a task they can see (i.e. they're a member of its current project) into a destination project they're also a member of.

Source-side access is already enforced by the task panel being reachable only for tasks the user can see.

## Behaviour on move (server, single transaction)

1. Reject if `task_dependencies` has any row where `predecessor_id = :id` or `successor_id = :id`.
2. Reject if the task's `pic_user_id` is non-null and that user is not a row in `project_members` for the destination project. The requester's role does not bypass this — it's a property of the PIC user, not the requester.
3. Reject if requester is not admin and not a member of the destination project.
4. Update `tasks.project_id` to the destination project id.
5. Set `tasks.sort_order` to `max(sort_order) + 1` within the destination project, so the task appears at the bottom of the destination's list/gantt.
6. Set `tasks.updated_at = now()`.
7. Return the updated task row.

Files (`task_files`), comments (`task_comments`), whiteboard (`task_excalidraw`), `ticket_number`, `title`, `description`, `start_date`, `end_date`, `status`, `created_at`, `pic_user_id` are untouched.

## API

`POST /api/tasks/:id/move`

Request body (Zod):

```ts
MoveTaskInput = z.object({ targetProjectId: z.string().uuid() })
```

Responses:

- `200` — updated `Task` row (same shape as PATCH).
- `400 VALIDATION_ERROR` — body malformed, or `targetProjectId` equals current `projectId`.
- `403 FORBIDDEN` — requester is neither admin nor a member of destination.
- `404 NOT_FOUND` — task or destination project does not exist.
- `409 HAS_DEPENDENCIES` — task has at least one row in `task_dependencies`.
- `409 PIC_NOT_IN_DESTINATION` — PIC is not a member of destination.

The error `code` field (already part of `HttpError`) is what the client switches on for the specific inline message.

### Why a dedicated endpoint, not PATCH

`PATCH /api/tasks/:id` is a field-level update with no cross-table effects. A move touches `sort_order` (computed from a query on the destination), and the validation rules differ (dependency check, destination membership check). Putting `projectId` in PATCH would make ordinary edits accidentally trigger those checks. A named action route keeps PATCH semantics simple and makes the move operation explicit.

## Client changes

### `TaskDetailPanel`

Add a new `<MoveTaskSection>` component, rendered between the existing `TaskForm` (which owns Save/Delete) and `DependencyPicker`.

### `MoveTaskSection` (new)

Props: `task: Task` (needs `id`, `projectId`, `picUserId`), `dependencyCount: number` (computed from existing `data.dependencies` already loaded in the panel).

Local state: `targetProjectId: string | null`, `error: string | null`, `isPending: boolean`.

Renders:

```
MOVE TO PROJECT
[select: choose a project ▾] [Move]
<inline error/info message if any>
```

The select is populated from a `useQuery(['projects'])` that calls `GET /api/projects` (already returns only the projects the current user can see). The current project is filtered out. If the user has access to no other project, render the section as "No other projects available" and disable the button.

On Move click:

1. Set `isPending = true`, clear error.
2. `POST /api/tasks/:id/move` with `{ targetProjectId }`.
3. On 200: invalidate `['project', oldProjectId, 'tasks']`, `['project', newProjectId, 'tasks']`, `['task', taskId]`, and close the panel (call the same `onDeleted`-style nav reset used by Delete — this is now `onMoved`, semantically equivalent here: the task is no longer in the current project view).
4. On error: read `error.code` and render the matching message inline. Specifically:
   - `HAS_DEPENDENCIES` → "This task has N dependencies. Remove them in **Depends on** before moving." (N comes from the already-loaded `data.dependencies.length`, not from the error.)
   - `PIC_NOT_IN_DESTINATION` → "PIC is not a member of the selected project. Unassign the PIC or add them to that project first."
   - `FORBIDDEN` → "You're not a member of that project."
   - anything else → generic "Move failed: <message>".

### Project dropdown rules

- Show only projects with `id !== currentProjectId`.
- Order alphabetically by `name`.
- For an admin, the list contains every project; for a member, it contains only their member projects (already the case in `GET /api/projects`).

## Data model

No schema changes. `tasks.project_id` is already a FK to `projects.id`. The only fields written are `project_id`, `sort_order`, `updated_at`.

## Testing

Server (Bun test + drizzle):

- happy path: member of A and B, no deps, no PIC → 200, task now in B, `sort_order` is `max+1` in B, untouched in B if B was empty (becomes 0).
- blocked by dependencies: task has incoming dep → 409 `HAS_DEPENDENCIES`. Same with outgoing dep.
- blocked by PIC: PIC is not a member of destination → 409 `PIC_NOT_IN_DESTINATION`.
- blocked by permission: member of source only → 403.
- admin bypasses membership check → 200.
- destination equals source → 400.
- destination project does not exist → 404.
- task does not exist → 404.

Client: lightweight component test for `MoveTaskSection` verifying it disables Move while pending and renders each error-code branch.

## Notes

- **Why block when PIC isn't a destination member, instead of clearing it?** Setting a PIC on a task today requires the user to be a member of that task's project ([`tasks.ts:101`](../../../packages/server/src/routes/tasks.ts#L101)). Auto-clearing on move would silently break that invariant from the user's mental model ("I assigned X, and the system just unassigned them without me asking"). Blocking surfaces the conflict and lets the user resolve it deliberately (either add the PIC to the destination or unassign first).

- **Project freshness in dropdown.** A user could get added to a new destination project from another tab and not see it immediately. Acceptable; `useQuery` refreshes on window focus by default.

## Rollout

Single PR. No migration. Feature appears for all users immediately on deploy. No flag.
