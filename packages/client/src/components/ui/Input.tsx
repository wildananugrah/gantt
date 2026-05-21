import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`h-8 px-2.5 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
