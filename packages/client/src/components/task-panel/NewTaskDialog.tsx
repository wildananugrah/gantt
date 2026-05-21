import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, User, TaskStatus } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { today } from '../../lib/date';

export function NewTaskDialog({ open, onClose, projectId, members }: {
  open: boolean; onClose: () => void; projectId: string; members: User[];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [picUserId, setPicUserId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<Task>(`/projects/${projectId}/tasks`, {
      title, startDate, endDate, status,
      picUserId: picUserId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setTitle(''); setStartDate(today()); setEndDate(today()); setStatus('todo'); setPicUserId('');
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </Select>
          <Select value={picUserId} onChange={(e) => setPicUserId(e.target.value)}>
            <option value="">PIC — none</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
