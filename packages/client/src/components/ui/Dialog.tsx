import { type ReactNode, useEffect } from 'react';

export function Dialog({
  open, onClose, title, children, size = 'sm', headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** sm = 420px (default), md = 640px, lg = 860px */
  size?: 'sm' | 'md' | 'lg';
  /** Optional content rendered on the right side of the header (e.g. action button). */
  headerExtra?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const widthClass = size === 'lg' ? 'w-[860px]' : size === 'md' ? 'w-[640px]' : 'w-[420px]';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20" onClick={onClose}>
      <div
        className={`bg-paper border border-rule rounded-md shadow-xl ${widthClass} max-w-[92vw] max-h-[88vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-11 border-b border-rule flex items-center px-4 gap-3 flex-shrink-0">
          <h2 className="text-[14px] font-semibold truncate flex-1">{title}</h2>
          {headerExtra}
        </header>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
