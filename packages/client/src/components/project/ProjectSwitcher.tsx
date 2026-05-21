import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Project } from '@app/shared';
import { Combobox, type ComboboxItem } from '../ui/Combobox';
import { NewProjectDialog } from './NewProjectDialog';

export function ProjectSwitcher() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  });
  const params = useParams({ strict: false }) as { id?: string };
  const nav = useNavigate();
  const { user } = useAuth();
  const [newOpen, setNewOpen] = useState(false);
  const current = projects?.find((p) => p.id === params.id);

  // "+ New project" is rendered as a sentinel item with a special key.
  type Item = Project | { __new: true };
  const items: ComboboxItem<Item>[] = [
    ...(projects ?? []).map<ComboboxItem<Item>>((p) => ({
      key: p.id,
      value: p,
      searchable: [p.name, p.description ?? ''],
      render: (_active) => (
        <div className="flex items-center gap-2">
          <span className="truncate flex-1">{p.name}</span>
          {p.id === params.id && <span className="text-[10px] text-muted">current</span>}
        </div>
      ),
    })),
    ...(user?.role === 'admin'
      ? [{
          key: '__new',
          value: { __new: true } as Item,
          searchable: ['new project', 'create project'],
          render: () => <span className="text-muted">+ New project</span>,
        }]
      : []),
  ];

  return (
    <>
      <Combobox<Item>
        items={items}
        placeholder="Search projects…"
        buttonLabel={<span className="truncate max-w-[180px]">{current?.name ?? 'Select project'}</span>}
        emptyMessage="No projects match"
        onPick={(it) => {
          if ((it.value as any).__new) setNewOpen(true);
          else nav({ to: '/projects/$id', params: { id: (it.value as Project).id } });
        }}
      />
      <NewProjectDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(p) => nav({ to: '/projects/$id', params: { id: p.id } })}
      />
    </>
  );
}
