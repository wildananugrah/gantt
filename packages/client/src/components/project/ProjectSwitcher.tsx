import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Project } from '@app/shared';
import { NewProjectDialog } from './NewProjectDialog';

export function ProjectSwitcher() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  });
  const params = useParams({ strict: false }) as { id?: string };
  const nav = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const current = projects?.find((p) => p.id === params.id);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2.5 text-[13px] flex items-center gap-1.5 border border-rule rounded bg-paper hover:bg-mist"
      >
        <span className="truncate max-w-[180px]">{current?.name ?? 'Select project'}</span>
        <span className="text-muted text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[240px] border border-rule rounded bg-paper shadow-lg py-1 max-h-[300px] overflow-y-auto">
          {(projects ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => { setOpen(false); nav({ to: '/projects/$id', params: { id: p.id } }); }}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-mist ${p.id === params.id ? 'bg-mist' : ''}`}
            >
              {p.name}
            </button>
          ))}
          {!projects?.length && <div className="px-3 py-2 text-[12px] text-muted">No projects</div>}
          {user?.role === 'admin' && (
            <button
              onClick={() => { setOpen(false); setNewOpen(true); }}
              className="w-full text-left px-3 py-1.5 text-[13px] text-muted hover:bg-mist border-t border-rule mt-1"
            >+ New project</button>
          )}
        </div>
      )}
      <NewProjectDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(p) => nav({ to: '/projects/$id', params: { id: p.id } })}
      />
    </div>
  );
}
