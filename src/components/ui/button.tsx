import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-[#2563eb] text-white hover:bg-[#1e40af] focus-visible:ring-[#2563eb]/25 disabled:bg-[#f1f5f9] disabled:text-[#64748b]',
        platform:
          'bg-[#6366f1] text-white hover:bg-[#4f46e5] focus-visible:ring-[#6366f1]/35 disabled:bg-[#1e293b] disabled:text-[#64748b]',
        secondary:
          'border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc] focus-visible:ring-[#2563eb]/20 disabled:bg-[#f1f5f9] disabled:text-[#64748b]',
        outline:
          'border border-[#e2e8f0] bg-transparent text-[#0f172a] hover:bg-[#f1f5f9] focus-visible:ring-[#2563eb]/20 disabled:opacity-60',
        destructive:
          'bg-[#dc2626] text-white hover:bg-[#b91c1c] focus-visible:ring-[#dc2626]/25 disabled:opacity-60',
        ghost:
          'text-[#0f172a] hover:bg-[#f1f5f9] focus-visible:ring-[#2563eb]/20 disabled:opacity-60',
      },
      size: {
        default: 'min-h-[44px] px-4 py-2',
        lg: 'min-h-[48px] px-5 py-3 text-base',
        sm: 'min-h-[44px] px-3 py-2 text-sm',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
