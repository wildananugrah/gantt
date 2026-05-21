export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-b border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[12px] flex items-center gap-3">
      <span className="flex-1">{message}</span>
      {onRetry && <button className="underline hover:no-underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}
