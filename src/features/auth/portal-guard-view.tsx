import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PortalAccessDeniedProps {
  authorizedPortal: string | null;
  message: string;
  theme?: 'operational' | 'platform';
}

/**
 * Displays a 403 Vietnamese access-denied screen linking users back to their own portal.
 */
export function PortalAccessDenied({
  authorizedPortal,
  message,
  theme = 'operational',
}: PortalAccessDeniedProps) {
  const isPlatform = theme === 'platform';

  return (
    <main
      className={cn(
        'flex min-h-screen flex-col items-center justify-center px-4 py-8',
        isPlatform ? 'bg-[#0b0f19] text-[#f8fafc]' : 'bg-[#f8fafc] text-[#0f172a]'
      )}
    >
      <Card
        className={cn(
          'w-full max-w-[460px]',
          isPlatform && 'border-[#1e293b] bg-[#111827] text-[#f8fafc]'
        )}
      >
        <CardHeader className="space-y-2">
          <p
            className={cn(
              'font-mono text-xs font-semibold uppercase tracking-wider',
              isPlatform ? 'text-[#818cf8]' : 'text-[#dc2626]'
            )}
          >
            HTTP 403
          </p>
          <CardTitle className={cn('text-2xl', isPlatform && 'text-[#f8fafc]')}>
            Không có quyền truy cập
          </CardTitle>
          <CardDescription className={isPlatform ? 'text-[#94a3b8]' : undefined}>
            Tài khoản đang đăng nhập không được phép mở trang quản lý này.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={isPlatform ? 'platformError' : 'destructive'}>
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Mã lỗi 403 — Truy cập bị từ chối</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          {authorizedPortal ? (
            <Button
              asChild
              variant={isPlatform ? 'platform' : 'default'}
              size="lg"
              className="w-full"
            >
              <Link href={authorizedPortal}>Quay lại cổng của bạn</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
