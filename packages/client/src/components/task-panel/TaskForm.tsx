import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, User, TaskStatus, UpdateTaskInput } from '@app/shared';
import { api } from '../../lib/api';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

export function TaskForm({ task, projectMembers, onDeleted }: {
  task: Task;
  projectMembers: User[];
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [picUserId, setPicUserId] = useState<string>(task.picUserId ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStartDate(task.startDate);
    setEndDate(task.endDate);
    setStatus(task.status);
    setPicUserId(task.picUserId ?? '');
  }, [task.id]);

  const save = useMutation({
    mutationFn: (body: UpdateTaskInput) => api.patch<Task>(`/tasks/${task.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
    onError: (e: any) => setErr(e.message ?? 'save failed'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      onDeleted();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        save.mutate({
          title,
          description: description.length === 0 ? null : description,
          startDate,
          endDate,
          status,
          picUserId: picUserId === '' ? null : picUserId,
        });
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="PIC">
          <Select value={picUserId} onChange={(e) => setPicUserId(e.target.value)}>
            <option value="">— none —</option>
            {projectMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (confirm(`Delete "${task.title}"? This cannot be undone.`)) del.mutate();
          }}
          disabled={del.isPending}
        >Delete</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
