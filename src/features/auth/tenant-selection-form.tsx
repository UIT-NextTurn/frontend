'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isSafeHttpUrl,
  type TenantVerifyInput,
  tenantVerifyResponseDataSchema,
  tenantVerifySchema,
} from '@/features/auth/tenant-verify.schema';

const verifySuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: tenantVerifyResponseDataSchema,
});

export interface TenantSelectionFormProps {
  onRedirect?: (url: string) => void;
}

function defaultRedirect(url: string) {
  window.location.assign(url);
}

export function TenantSelectionForm({ onRedirect }: TenantSelectionFormProps) {
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TenantVerifyInput>({
    resolver: zodResolver(tenantVerifySchema),
    defaultValues: {
      tenantCode: '',
    },
  });

  async function onSubmit(values: TenantVerifyInput) {
    setIsPending(true);
    try {
      const response = await fetch('/api/auth/tenant/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ tenantCode: values.tenantCode }),
      });

      const payload: unknown = await response.json();
      const parsed = verifySuccessEnvelopeSchema.safeParse(payload);
      if (response.ok && parsed.success && isSafeHttpUrl(parsed.data.data.loginUrl)) {
        const redirectTarget = onRedirect ?? defaultRedirect;
        redirectTarget(parsed.data.data.loginUrl);
        return;
      }
    } finally {
      setIsPending(false);
    }
  }

  const errorMessage = errors.tenantCode?.message;
  const describedBy = errorMessage ? 'tenantCode-error tenantCode-help' : 'tenantCode-help';

  return (
    <Card className="w-full max-w-[460px]">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb] text-white"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 7h10" />
              <path d="M5 12h14" />
              <path d="M15 8l4 4-4 4" />
              <path d="M5 17h8" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-[#0f172a]">NextTurn</span>
        </div>
        <div className="space-y-1">
          <CardTitle>Đăng nhập nhân sự</CardTitle>
          <CardDescription>
            Nhập mã cơ sở để chuyển đến cổng đăng nhập dành cho Quản trị viên cơ sở và Nhân viên
            quầy.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tenantCode">Mã cơ sở</Label>
            <Input
              id="tenantCode"
              type="text"
              placeholder="pk-alpha"
              autoComplete="organization"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={describedBy}
              disabled={isPending}
              {...register('tenantCode')}
            />
            {errorMessage ? (
              <p id="tenantCode-error" role="alert" className="text-xs font-medium text-[#dc2626]">
                {errorMessage}
              </p>
            ) : null}
            <p id="tenantCode-help" className="text-xs text-[#64748b]">
              Từ 3–30 ký tự gồm chữ thường không dấu, số và dấu gạch ngang (-).
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Đang xác minh...
              </>
            ) : (
              'Tiếp tục'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="bg-[#f8fafc] text-xs text-[#475569]">
        Quên mã cơ sở? Liên hệ Quản trị viên cơ sở hoặc bộ phận hỗ trợ nền tảng.
      </CardFooter>
    </Card>
  );
}
