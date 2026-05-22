import { forwardRef, useState, type InputHTMLAttributes } from 'react';

/**
 * Password input with a visibility toggle. Drop-in replacement for the bare
 * <Input type="password"> wherever we collect a password.
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={`h-8 w-full pl-2.5 pr-9 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 w-9 flex items-center justify-center text-muted hover:text-ink text-[14px] leading-none"
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
