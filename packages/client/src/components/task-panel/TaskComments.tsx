import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { TaskComment } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

export function TaskComments({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const commentsQ = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.get<TaskComment[]>(`/tasks/${taskId}/comments`),
  });

  const add = useMutation({
    mutationFn: () => api.post<TaskComment>(`/tasks/${taskId}/comments`, { body: draft.trim() }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
    },
    onError: (e) => toast.error(e instanceof ApiException ? e.message : 'failed to add'),
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch<TaskComment>(`/comments/${id}`, { body }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['comments', taskId] });
    },
    onError: (e) => toast.error(e instanceof ApiException ? e.message : 'failed to edit'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
    onError: (e) => toast.error(e instanceof ApiException ? e.message : 'failed to delete'),
  });

  const comments = commentsQ.data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">
        Comments {comments.length > 0 && <span className="text-muted">({comments.length})</span>}
      </h3>

      <ul className="flex flex-col gap-2">
        {comments.map((c) => {
          const isMine = user && c.authorId === user.id;
          const canDelete = isMine || user?.role === 'admin';
          if (editingId === c.id) {
            return (
              <li key={c.id} className="border border-rule rounded p-2.5 flex flex-col gap-2 bg-mist/40">
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  autoFocus
                  className="min-h-[64px]"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    disabled={edit.isPending || editDraft.trim().length === 0 || editDraft.trim() === c.body}
                    onClick={() => edit.mutate({ id: c.id, body: editDraft.trim() })}
                  >Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </li>
            );
          }
          return (
            <li key={c.id} className="border border-rule rounded px-3 py-2 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span className="font-medium text-ink">{c.authorName}</span>
                <span>·</span>
                <span title={c.createdAt}>{formatRelative(c.createdAt)}</span>
                {c.edited && <span className="italic">(edited)</span>}
                <span className="flex-1" />
                {isMine && (
                  <button
                    type="button"
                    className="text-muted hover:text-ink"
                    onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                  >Edit</button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="text-muted hover:text-red-600"
                    onClick={() => {
                      if (confirm('Delete this comment?')) del.mutate(c.id);
                    }}
                  >Delete</button>
                )}
              </div>
              <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          );
        })}
        {comments.length === 0 && !commentsQ.isLoading && (
          <li className="text-[12px] text-muted">No comments yet.</li>
        )}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim().length === 0) return;
          add.mutate();
        }}
        className="flex flex-col gap-2 pt-1"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          maxLength={5000}
          className="min-h-[64px]"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={add.isPending || draft.trim().length === 0}>
            {add.isPending ? 'Posting…' : 'Post'}
          </Button>
          {draft.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setDraft('')}>Clear</Button>
          )}
        </div>
      </form>
    </section>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
