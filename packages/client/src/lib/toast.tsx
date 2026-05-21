import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onClose={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} />)}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icon = toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i';
  const iconBg =
    toast.kind === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : toast.kind === 'error' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-mist text-muted border-rule';
  return (
    <div className="pointer-events-auto bg-paper border border-rule rounded-md shadow-sm pl-2 pr-3 py-2 flex items-center gap-2.5 min-w-[240px] max-w-[360px] text-[12px] animate-[toast-in_120ms_ease-out]">
      <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full border text-[11px] font-bold ${iconBg}`}>{icon}</span>
      <span className="flex-1 text-ink leading-snug">{toast.message}</span>
      <button className="text-muted hover:text-ink text-[14px] leading-none" onClick={onClose}>×</button>
    </div>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
