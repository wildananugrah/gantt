import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskFile } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Button } from '../ui/Button';
import { MarkdownPreview, isMarkdownFile } from './MarkdownPreview';

/**
 * POSTs a multipart/form-data upload to our own API (NOT to S3 directly), reporting progress.
 * The server proxies the bytes to S3 so the browser doesn't need to reach the bucket directly.
 */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<TaskFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true; // send the auth cookie
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as TaskFile); }
        catch { reject(new Error('upload succeeded but response was not JSON')); }
      } else {
        let msg = `upload failed: ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (err?.error?.message) msg = err.error.message;
        } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(form);
  });
}

export function FileUploader({ taskId, files }: { taskId: string; files: TaskFile[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [progress, setProgress] = useState<{ filename: string; pct: number } | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [queueIndex, setQueueIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);

  async function uploadOne(file: File): Promise<void> {
    setProgress({ filename: file.name, pct: 0 });
    await uploadWithProgress(`/api/tasks/${taskId}/files`, file, (pct) =>
      setProgress({ filename: file.name, pct }),
    );
  }

  const uploadAll = useMutation({
    mutationFn: async (incoming: File[]) => {
      setQueueLength(incoming.length);
      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < incoming.length; i++) {
        setQueueIndex(i + 1);
        try {
          await uploadOne(incoming[i]!);
          succeeded++;
        } catch (e) {
          failed++;
          toast.error(`Couldn't upload "${incoming[i]!.name}": ${e instanceof ApiException ? e.message : (e as Error).message}`);
        }
      }
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      setProgress(null); setQueueLength(0); setQueueIndex(0);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      if (succeeded > 0) toast.success(succeeded === 1 ? 'File uploaded' : `${succeeded} files uploaded`);
      // failures already toasted per-file
      void failed;
    },
    onError: () => {
      setProgress(null); setQueueLength(0); setQueueIndex(0);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const del = useMutation({
    mutationFn: (fileId: string) => api.delete(`/files/${fileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('File deleted');
    },
    onError: (e: any) => toast.error(`Couldn't delete: ${e.message ?? 'unknown error'}`),
  });

  function startUpload(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.size > 0);
    if (arr.length === 0) return;
    uploadAll.mutate(arr);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (uploadAll.isPending) return;
    startUpload(e.dataTransfer.files);
  }

  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current++;
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave(_e: React.DragEvent<HTMLDivElement>) {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  const busy = uploadAll.isPending;
  const status = busy
    ? (queueLength > 1
        ? `Uploading ${queueIndex} of ${queueLength}: ${progress?.filename ?? ''} (${progress?.pct ?? 0}%)`
        : `Uploading ${progress?.filename ?? ''} (${progress?.pct ?? 0}%)`)
    : null;

  return (
    <section
      className="flex flex-col gap-2"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Files</h3>
      <ul className="flex flex-col gap-1">
        {files.map((f) => {
          const isMd = isMarkdownFile(f);
          return (
            <li key={f.id} className="flex items-center gap-2 border border-rule rounded px-2 py-1 text-[13px]">
              {isMd ? (
                <button
                  type="button"
                  onClick={() => setPreviewFile(f)}
                  className="flex-1 truncate text-left hover:underline"
                  title="Preview markdown"
                >{f.filename}</button>
              ) : (
                <a
                  href={`/api/files/${f.id}/download`}
                  className="flex-1 truncate hover:underline"
                  target="_blank" rel="noreferrer"
                >{f.filename}</a>
              )}
              <span className="text-[11px] text-muted">{Math.round(f.sizeBytes / 1024)} KB</span>
              <Button type="button" variant="ghost" onClick={() => del.mutate(f.id)}>Delete</Button>
            </li>
          );
        })}
        {files.length === 0 && <li className="text-[12px] text-muted">— none —</li>}
      </ul>

      <div
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`mt-1 rounded border-2 border-dashed py-4 px-3 text-center text-[12px] cursor-pointer transition-colors ${
          dragOver
            ? 'border-focus bg-focus/5 text-ink'
            : busy
              ? 'border-rule bg-mist/50 text-muted cursor-wait'
              : 'border-rule text-muted hover:border-ink/40 hover:bg-mist'
        }`}
      >
        {status ?? (
          <>
            <span className="font-medium text-ink">Drop files here</span>
            <span> or click to choose</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) startUpload(e.target.files);
          e.target.value = '';
        }}
      />
      {previewFile && (
        <MarkdownPreview
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
        />
      )}
    </section>
  );
}
