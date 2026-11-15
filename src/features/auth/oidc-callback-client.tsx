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

interface CallbackAlertState {
  title: string;
  message: string;
}

interface ScopedExchangeError {
  code: string;
  alert: CallbackAlertState;
}

const exchangeErrorTitles: Record<string, string> = {
  AUTH_003: 'Không tìm thấy cơ sở',
  AUTH_004: 'Cơ sở chưa sẵn sàng hoạt động',
  AUTH_005: 'Mã xác thực đã hết hạn',
  AUTH_007: 'Phiên xác thực không hợp lệ',
  AUTH_010: 'Tài khoản không có quyền truy cập',
  AUTH_011: 'Dịch vụ Keycloak tạm gián đoạn',
};

function resolveQueryRecoveryState(oauthError: string, code: string): CallbackAlertState | null {
  if (oauthError) {
    if (oauthError === 'access_denied') {
      return {
        title: 'Bạn đã hủy đăng nhập',
        message:
          'Quá trình đăng nhập tại Keycloak đã bị hủy. Vui lòng chọn lại cơ sở và thử đăng nhập lại.',
      };
    }

    return {
      title: 'Đăng nhập chưa hoàn tất',
      message:
        'Dịch vụ xác thực trả về lỗi và không thể hoàn tất phiên làm việc. Vui lòng quay lại và thử lại.',
    };
  }

  if (!code) {
    return {
      title: 'Thiếu mã xác thực',
      message: 'Liên kết xác thực không chứa mã phiên hợp lệ. Vui lòng bắt đầu lại từ đầu.',
    };
  }

  return null;
}

function buildExchangeErrorState(
  errorCode: string | undefined,
  backendMessage: string | undefined
): CallbackAlertState {
  if (errorCode === 'AUTH_010') {
    return {
      title: exchangeErrorTitles.AUTH_010,
      message:
        'Tài khoản khách hàng không thể đăng nhập vào cổng quản lý nhân sự. Cổng này chỉ dành cho Quản trị viên cơ sở, Nhân viên quầy hoặc Quản trị viên nền tảng.',
    };
  }

  return {
    title: (errorCode ? exchangeErrorTitles[errorCode] : undefined) ?? 'Xác thực thất bại',
    message: backendMessage ?? 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.',
  };
}

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
  const oauthError = searchParams.get('error')?.trim() ?? '';
  const code = searchParams.get('code')?.trim() ?? '';
  const queryRecoveryError = resolveQueryRecoveryState(oauthError, code);

  const isMountedRef = useRef(true);
  const startedCodeRef = useRef<string | null>(null);
  const clearedStaleSessionRef = useRef(false);
  const [exchangeError, setExchangeError] = useState<ScopedExchangeError | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    async function clearStaleSession() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore cleanup failures so the Vietnamese recovery card renders without interruption.
      }
    }

    if (oauthError || !code) {
      if (!clearedStaleSessionRef.current) {
        clearedStaleSessionRef.current = true;
        void clearStaleSession();
      }

      return () => {
        isMountedRef.current = false;
      };
    }

    clearedStaleSessionRef.current = false;

    if (startedCodeRef.current === code) {
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

        if (!isMountedRef.current || startedCodeRef.current !== authCode) {
          return;
        }

        if (!response.ok) {
          const parsedError = callbackErrorSchema.safeParse(payload);
          setExchangeError({
            code: authCode,
            alert: buildExchangeErrorState(
              parsedError.success ? parsedError.data.errorCode : undefined,
              parsedError.success ? parsedError.data.message : undefined
            ),
          });
          return;
        }

        const parsedSuccess = callbackSuccessSchema.safeParse(payload);
        if (!parsedSuccess.success) {
          setExchangeError({
            code: authCode,
            alert: {
              title: 'Xác thực thất bại',
              message: 'Không thể xác định cổng làm việc phù hợp cho tài khoản này.',
            },
          });
          return;
        }

        router.replace(parsedSuccess.data.data.redirectPath);
      } catch {
        if (isMountedRef.current && startedCodeRef.current === authCode) {
          setExchangeError({
            code: authCode,
            alert: {
              title: 'Lỗi kết nối xác thực',
              message: 'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.',
            },
          });
        }
      }
    }

    void exchangeAuthorizationCode(code);

    return () => {
      isMountedRef.current = false;
    };
  }, [code, oauthError, router]);

  const activeError =
    queryRecoveryError ?? (exchangeError?.code === code ? exchangeError.alert : null);

  if (activeError) {
    return (
      <Card className="w-full max-w-[420px]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Không thể hoàn tất đăng nhập</CardTitle>
          <CardDescription>Quá trình xác thực tài khoản chưa thể tiếp tục.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{activeError.title}</AlertTitle>
            <AlertDescription>{activeError.message}</AlertDescription>
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
