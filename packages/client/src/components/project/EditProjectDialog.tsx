import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Project } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export function EditProjectDialog({
  open, onClose, project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? '');
      setErr(null);
    }
  }, [open, project.id, project.name, project.description]);

  const save = useMutation({
    mutationFn: () => api.patch<Project>(`/projects/${project.id}`, {
      name,
      description: description.length === 0 ? null : description,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success(`Project "${name}" updated`);
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'save failed'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/projects/${project.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Project "${project.name}" deleted`);
      onClose();
      nav({ to: '/' });
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'delete failed'),
  });

  const dirty = name !== project.name || (description || '') !== (project.description ?? '');

  return (
    <Dialog open={open} onClose={onClose} title="Edit project">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} maxLength={120} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={save.isPending || !dirty}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <span className="flex-1" />
          <Button
            type="button"
            variant="danger"
            disabled={del.isPending}
            onClick={() => {
              const ok = confirm(
                `Delete project "${project.name}"? This permanently removes all its tasks, files, and members. This cannot be undone.`,
              );
              if (ok) del.mutate();
            }}
          >Delete project</Button>
        </div>
      </form>
    </Dialog>
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
