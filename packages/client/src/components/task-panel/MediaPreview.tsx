import type { TaskFile } from '@app/shared';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function isImageFile(f: { filename: string; contentType: string }): boolean {
  if (/^image\//i.test(f.contentType)) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.filename);
}

export function isVideoFile(f: { filename: string; contentType: string }): boolean {
  if (/^video\//i.test(f.contentType)) return true;
  return /\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(f.filename);
}

export function isMediaFile(f: { filename: string; contentType: string }): boolean {
  return isImageFile(f) || isVideoFile(f);
}

export function MediaPreview({
  open, onClose, file,
}: {
  open: boolean;
  onClose: () => void;
  file: TaskFile;
}) {
  const src = `/api/files/${file.id}/download`;
  const video = isVideoFile(file);

  const headerExtra = (
    <a
      href={src}
      download={file.filename}
      className="text-[12px] text-muted hover:text-ink"
      title="Download raw file"
    >Download ↓</a>
  );

  return (
    <Dialog open={open} onClose={onClose} title={file.filename} size="lg" headerExtra={headerExtra}>
      <div className="flex items-center justify-center min-h-[200px] bg-mist/40 rounded">
        {video ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-w-full max-h-[72vh] rounded"
          />
        ) : (
          <img
            src={src}
            alt={file.filename}
            className="max-w-full max-h-[72vh] object-contain rounded"
          />
        )}
      </div>
      <div className="pt-4 mt-4 border-t border-rule flex items-center justify-between text-[11px] text-muted">
        <span>{Math.round(file.sizeBytes / 1024).toLocaleString()} KB · {file.contentType || 'unknown type'}</span>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Dialog>
  );
}
