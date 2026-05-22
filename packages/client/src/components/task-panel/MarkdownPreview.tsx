import { useEffect, useState } from 'react';
import type { TaskFile } from '@app/shared';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function isMarkdownFile(f: { filename: string; contentType: string }): boolean {
  if (/^text\/(x-)?markdown/i.test(f.contentType)) return true;
  return /\.(md|markdown)$/i.test(f.filename);
}

export function MarkdownPreview({
  open, onClose, file,
}: {
  open: boolean;
  onClose: () => void;
  file: TaskFile;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHtml(null);
    setErr(null);
    let cancelled = false;

    (async () => {
      try {
        const [{ marked }, dompurifyMod] = await Promise.all([
          import('marked'),
          import('dompurify'),
        ]);
        const DOMPurify = (dompurifyMod as any).default ?? dompurifyMod;

        const res = await fetch(`/api/files/${file.id}/download`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Couldn't load file: HTTP ${res.status}`);
        const raw = await res.text();

        // GFM tables/strikethrough/task-lists; line breaks → <br>.
        const parsed = await marked.parse(raw, { gfm: true, breaks: true, async: true });
        const safe = DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } });
        if (!cancelled) setHtml(safe);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? 'failed to render');
      }
    })();

    return () => { cancelled = true; };
  }, [open, file.id]);

  const headerExtra = (
    <a
      href={`/api/files/${file.id}/download`}
      download={file.filename}
      className="text-[12px] text-muted hover:text-ink"
      title="Download raw file"
    >Download ↓</a>
  );

  return (
    <Dialog open={open} onClose={onClose} title={file.filename} size="lg" headerExtra={headerExtra}>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      {!err && html === null && <p className="text-[12px] text-muted">Loading…</p>}
      {html !== null && (
        <article className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div className="pt-4 mt-4 border-t border-rule flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
}
