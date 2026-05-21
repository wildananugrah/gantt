import { type ReactNode, useEffect } from 'react';

export function Dialog({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20" onClick={onClose}>
      <div
        className="bg-paper border border-rule rounded-md shadow-xl w-[420px] max-w-[90vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-11 border-b border-rule flex items-center px-4">
          <h2 className="text-[14px] font-semibold">{title}</h2>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
