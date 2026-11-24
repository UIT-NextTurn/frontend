'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';

export interface LogoutButtonProps {
  variant?: ButtonProps['variant'];
  className?: string;
}

/**
 * Terminates the active session via BFF POST /api/auth/logout and returns to /login.
 */
export function LogoutButton({ variant = 'secondary', className }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Navigate back to login even if the client logout request is interrupted.
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={isLoggingOut}
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span>{isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
    </Button>
  );
}
