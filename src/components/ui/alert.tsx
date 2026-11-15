import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export const alertVariants = cva(
  'relative w-full rounded-xl border px-4 py-3 text-sm [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:top-3.5 [&>svg]:left-4',
  {
    variants: {
      variant: {
        default: 'border-[#e2e8f0] bg-[#f1f5f9] text-[#0f172a] [&>svg]:text-[#475569]',
        info: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a] [&>svg]:text-[#2563eb]',
        success: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46] [&>svg]:text-[#059669]',
        warning: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e] [&>svg]:text-[#d97706]',
        destructive: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b] [&>svg]:text-[#dc2626]',
        platformError: 'border-[#7f1d1d] bg-[#1f1318] text-[#fecaca] [&>svg]:text-[#f87171]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps extends ComponentProps<'div'>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role = 'alert', ...props }: AlertProps) {
  return <div role={role} className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('mb-1 font-semibold leading-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('text-sm leading-relaxed', className)} {...props} />;
}
