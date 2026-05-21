import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Task, Dependency } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

export function DependencyPicker({
  task, allTasks, dependencies,
}: {
  task: Task;
  allTasks: Task[];
  dependencies: Dependency[];
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const myPreds = dependencies.filter((d) => d.successorId === task.id);
  const predIds = new Set(myPreds.map((d) => d.predecessorId));
  const candidates = allTasks.filter((t) => t.id !== task.id && !predIds.has(t.id));

  const add = useMutation({
    mutationFn: (predecessorId: string) =>
      api.post(`/tasks/${task.id}/dependencies`, { predecessorId }),
    onSuccess: () => {
      setAdding('');
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  const remove = useMutation({
    mutationFn: (predecessorId: string) =>
      api.delete(`/tasks/${task.id}/dependencies/${predecessorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
  });

  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Depends on</h3>
      {myPreds.length === 0 && <p className="text-[12px] text-muted">— none —</p>}
      <ul className="flex flex-col gap-1">
        {myPreds.map((d) => {
          const p = taskById.get(d.predecessorId);
          if (!p) return null;
          return (
            <li key={d.predecessorId} className="flex items-center gap-2 border border-rule rounded px-2 py-1 text-[13px]">
              <span className="flex-1 truncate">{p.title}</span>
              <span className="text-[11px] text-muted">{p.endDate}</span>
              <Button type="button" variant="ghost" onClick={() => remove.mutate(d.predecessorId)}>Remove</Button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Select value={adding} onChange={(e) => { setErr(null); setAdding(e.target.value); }} className="flex-1">
          <option value="">+ add predecessor…</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
        <Button
          type="button"
          disabled={!adding || add.isPending}
          onClick={() => add.mutate(adding)}
        >Add</Button>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </section>
  );
}
