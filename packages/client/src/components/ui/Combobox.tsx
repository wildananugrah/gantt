import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ComboboxItem<T> = {
  key: string;
  value: T;
  /** Plain-text fields the query matches against (case-insensitive substring). */
  searchable: string[];
  /** Rendered row inside the dropdown. Receives the highlighted state for styling. */
  render: (active: boolean) => ReactNode;
};

/**
 * Generic typeahead. Renders an input that filters `items` and shows a popover list.
 * Keyboard: ↑/↓ to navigate, Enter to pick, Esc to close.
 */
export function Combobox<T>({
  items,
  placeholder,
  buttonLabel,
  onPick,
  emptyMessage = 'No matches',
  className = '',
  width = 'min-w-[260px]',
}: {
  items: ComboboxItem<T>[];
  placeholder: string;
  /** Trigger label shown when closed (acts like a select). If omitted, an always-open input is shown. */
  buttonLabel?: ReactNode;
  onPick: (item: ComboboxItem<T>) => void;
  emptyMessage?: string;
  className?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(buttonLabel == null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = q === ''
    ? items
    : items.filter((it) => it.searchable.some((s) => s.toLowerCase().includes(q)));

  useEffect(() => { setActiveIndex(0); }, [query, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      // small delay so the input is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  function pick(idx: number) {
    const it = filtered[idx];
    if (!it) return;
    onPick(it);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(activeIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {buttonLabel != null && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-7 px-2.5 text-[13px] flex items-center gap-1.5 border border-rule rounded bg-paper hover:bg-mist"
        >
          {buttonLabel}
          <span className="text-muted text-[10px]">▾</span>
        </button>
      )}

      {open && (
        <>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="h-7 px-2.5 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
          />
          <div className={`absolute left-0 top-full mt-1 z-30 ${width} max-h-[320px] overflow-y-auto bg-paper border border-rule rounded shadow-lg py-1`}>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-muted">{emptyMessage}</div>
            )}
            {filtered.map((it, i) => (
              <button
                key={it.key}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(i)}
                className={`w-full text-left px-3 py-1.5 text-[13px] ${i === activeIndex ? 'bg-mist' : 'hover:bg-mist'}`}
              >
                {it.render(i === activeIndex)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
