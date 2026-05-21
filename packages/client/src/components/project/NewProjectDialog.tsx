import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export function NewProjectDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated?: (p: Project) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<Project>('/projects', {
      name,
      description: description ? description : undefined,
    }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setName(''); setDescription('');
      onClose();
      onCreated?.(p);
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
