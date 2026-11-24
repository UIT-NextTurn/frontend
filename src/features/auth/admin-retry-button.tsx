'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Triggers a fresh Server Component request on /admin when Keycloak URL discovery fails.
 */
export function AdminRetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="platform"
      size="lg"
      className="w-full"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      <span>{isPending ? 'Đang kết nối lại…' : 'Thử lại'}</span>
    </Button>
  );
}
