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
            dependencyCount > 0
              ? `This task has ${dependencyCount} dependenc${dependencyCount === 1 ? 'y' : 'ies'}. ` +
                `Remove them in Depends on before moving.`
              : `This task is a prerequisite for another task. Remove that dependency before moving.`,
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
      ) : projectsQ.isError ? (
        <div className="text-[12px] text-red-600 leading-snug">Could not load projects. Refresh and try again.</div>
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
