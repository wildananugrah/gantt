import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-[72px] px-2.5 py-1.5 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
