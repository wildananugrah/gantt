import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useTheme } from '../../lib/theme';
import { Button } from '../ui/Button';

const Excalidraw = lazy(() => import('./LazyExcalidraw'));

type SceneData = {
  elements: readonly any[];
  appState: Record<string, any>;
  files?: Record<string, any>;
};

const SAVE_DEBOUNCE_MS = 1200;

export function TaskExcalidraw({
  taskId, taskTitle, onClose,
}: {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { theme } = useTheme();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const initialQ = useQuery({
    queryKey: ['excalidraw', taskId],
    queryFn: () => api.get<{ data: SceneData | null }>(`/tasks/${taskId}/excalidraw`),
    staleTime: Infinity, // we own the data while the modal is open
  });

  // Hold the latest scene in a ref so debounced save reads fresh state without re-rendering.
  const latestRef = useRef<SceneData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialData = useMemo(() => {
    const d = initialQ.data?.data;
    if (!d) return null;
    // Excalidraw is fussy about appState shape — drop any legacy collaborators field.
    const { collaborators, ...appState } = d.appState ?? {};
    return { elements: d.elements ?? [], appState, files: d.files ?? {} };
  }, [initialQ.data]);

  const putScene = useCallback(async (scene: SceneData) => {
    setStatus('saving');
    const res = await fetch(`/api/tasks/${taskId}/excalidraw`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: scene }),
    });
    if (!res.ok) {
      setStatus('error');
      const txt = await res.text().catch(() => '');
      toast.error(`Couldn't save whiteboard: HTTP ${res.status} ${txt}`);
      return;
    }
    setStatus('saved');
  }, [taskId, toast]);

  const onChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    // Strip transient ui state that Excalidraw doesn't want on rehydrate.
    const { collaborators, ...persistableAppState } = appState ?? {};
    latestRef.current = {
      elements: [...elements],
      appState: persistableAppState,
      files: files ?? {},
    };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void putScene(latestRef.current!);
    }, SAVE_DEBOUNCE_MS);
  }, [putScene]);

  // Flush on unmount / close so we don't lose the last edit.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (latestRef.current) void putScene(latestRef.current);
      }
    };
  }, [putScene]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusLabel =
    status === 'saving' ? 'Saving…' :
    status === 'saved'  ? 'Saved' :
    status === 'error'  ? 'Save failed' :
    initialQ.isFetching ? 'Loading…' : '';

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col">
      <header className="h-12 border-b border-rule flex items-center px-4 gap-3 flex-shrink-0">
        <h2 className="text-[14px] font-semibold truncate flex-1">Whiteboard — {taskTitle}</h2>
        <span className={`text-[11px] ${status === 'error' ? 'text-red-600' : 'text-muted'}`}>{statusLabel}</span>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </header>
      <div className="flex-1 min-h-0">
        {initialQ.isLoading ? (
          <div className="h-full grid place-items-center text-muted text-[13px]">Loading whiteboard…</div>
        ) : (
          <Suspense fallback={<div className="h-full grid place-items-center text-muted text-[13px]">Loading whiteboard editor…</div>}>
            <Excalidraw
              theme={theme}
              initialData={initialData ?? undefined}
              onChange={onChange}
              UIOptions={{ canvasActions: { loadScene: false, saveAsImage: true, export: false } }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
