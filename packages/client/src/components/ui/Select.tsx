import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`h-8 px-2 text-[13px] border border-rule rounded bg-paper text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
