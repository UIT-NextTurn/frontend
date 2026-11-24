import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export type InputProps = ComponentProps<'input'>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex min-h-[48px] w-full rounded-lg border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-sm text-[#0f172a] transition-colors duration-150 placeholder:text-[#64748b] focus-visible:border-[#2563eb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/15 aria-[invalid=true]:border-[#dc2626] aria-[invalid=true]:focus-visible:ring-[#dc2626]/20 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#64748b]',
        className
      )}
      {...props}
    />
  );
}
