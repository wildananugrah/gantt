import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const base = 'inline-flex items-center justify-center gap-1.5 h-7 px-3 text-[13px] rounded border transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper border-ink hover:bg-black',
  ghost:   'bg-paper text-ink border-rule hover:bg-mist',
  danger:  'bg-paper text-ink border-rule hover:bg-mist hover:text-red-600',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant = 'primary', className = '', ...props }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
  ),
);
Button.displayName = 'Button';
