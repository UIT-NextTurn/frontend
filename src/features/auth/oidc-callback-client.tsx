'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const callbackSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    redirectPath: z.string().refine((path) => path.startsWith('/') && !path.startsWith('//'), {
      message: 'Đường dẫn điều hướng không hợp lệ.',
    }),
  }),
});

const callbackErrorSchema = z.object({
  success: z.literal(false).optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Fallback processing card rendered by the callback page Suspense boundary.
 */
export function CallbackProcessingCard() {
  return (
    <Card className="w-full max-w-[420px]">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">Đang hoàn tất đăng nhập</CardTitle>
        <CardDescription>
          Đang xác thực phiên làm việc và chuyển hướng đến cổng phù hợp.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p aria-live="polite" className="text-sm text-[#475569]">
          Vui lòng đợi trong giây lát…
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Exchanges the Keycloak authorization code via BFF POST /api/auth/token once on mount.
 */
export function OidcCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.trim() ?? '';

  const isMountedRef = useRef(true);
  const startedCodeRef = useRef<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    if (!code || startedCodeRef.current === code) {
      return () => {
        isMountedRef.current = false;
      };
    }

    startedCodeRef.current = code;

    async function exchangeAuthorizationCode(authCode: string) {
      try {
        const response = await fetch('/api/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: authCode,
            redirectUri: `${window.location.origin}/auth/callback`,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!isMountedRef.current) {
          return;
        }

        if (!response.ok) {
          const parsedError = callbackErrorSchema.safeParse(payload);
          setExchangeError(
            parsedError.success && parsedError.data.message
              ? parsedError.data.message
              : 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.'
          );
          return;
        }

        const parsedSuccess = callbackSuccessSchema.safeParse(payload);
        if (!parsedSuccess.success) {
          setExchangeError('Không thể xác định cổng làm việc phù hợp cho tài khoản này.');
          return;
        }

        router.replace(parsedSuccess.data.data.redirectPath);
      } catch {
        if (isMountedRef.current) {
          setExchangeError('Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.');
        }
      }
    }

    void exchangeAuthorizationCode(code);

    return () => {
      isMountedRef.current = false;
    };
  }, [code, router]);

  if (exchangeError) {
    return (
      <Card className="w-full max-w-[420px]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Không thể hoàn tất đăng nhập</CardTitle>
          <CardDescription>Quá trình xác thực tài khoản chưa thể tiếp tục.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Xác thực thất bại</AlertTitle>
            <AlertDescription>{exchangeError}</AlertDescription>
          </Alert>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/login">Quay lại chọn cơ sở</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <CallbackProcessingCard />;
}
