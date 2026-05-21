import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskFile, PresignUploadResult } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Button } from '../ui/Button';

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}

export function FileUploader({ taskId, files }: { taskId: string; files: TaskFile[] }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setErr(null);
      setProgress(0);
      const presign = await api.post<PresignUploadResult>(`/tasks/${taskId}/files/presign`, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await uploadWithProgress(presign.uploadUrl, file, setProgress);
      await api.post(`/tasks/${taskId}/files`, {
        filename: file.name,
        s3Key: presign.s3Key,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
    },
    onSuccess: () => {
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (e) => {
      setProgress(null);
      setErr(e instanceof ApiException ? e.message : 'upload failed');
    },
  });

  const del = useMutation({
    mutationFn: (fileId: string) => api.delete(`/files/${fileId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Files</h3>
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border border-rule rounded px-2 py-1 text-[13px]">
            <a
              href={`/api/files/${f.id}/download`}
              className="flex-1 truncate hover:underline"
              target="_blank" rel="noreferrer"
            >{f.filename}</a>
            <span className="text-[11px] text-muted">{Math.round(f.sizeBytes / 1024)} KB</span>
            <Button type="button" variant="ghost" onClick={() => del.mutate(f.id)}>Delete</Button>
          </li>
        ))}
        {files.length === 0 && <li className="text-[12px] text-muted">— none —</li>}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? `Uploading… ${progress ?? 0}%` : 'Upload file'}
        </Button>
        {err && <span className="text-[12px] text-red-600">{err}</span>}
      </div>
    </section>
  );
}
