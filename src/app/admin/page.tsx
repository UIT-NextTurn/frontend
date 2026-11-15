import { AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchSuperAdminLoginUrl } from '@/features/auth/admin-entry-service';
import { AdminRetryButton } from '@/features/auth/admin-retry-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản trị viên nền tảng — NextTurn',
};

export default async function AdminPage() {
  const loginResult = await fetchSuperAdminLoginUrl();

  if (loginResult.ok) {
    redirect(loginResult.loginUrl);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f19] px-4 py-8 text-[#f8fafc]">
      <Card className="w-full max-w-[440px] border-[#1e293b] bg-[#111827] text-[#f8fafc] shadow-none">
        <CardHeader className="space-y-2">
          <span className="inline-flex w-fit items-center rounded-full border border-[#312e81] bg-[#1e1b4b] px-3 py-1 text-xs font-semibold text-[#a5b4fc]">
            Quản trị viên nền tảng
          </span>
          <CardTitle className="text-2xl text-[#f8fafc]">
            Cổng Quản trị viên nền tảng tạm thời gián đoạn
          </CardTitle>
          <CardDescription className="text-[#94a3b8]">
            Không thể khởi tạo chuyển hướng đăng nhập trực tiếp đến Keycloak.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="platformError">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Không thể khởi tạo phiên đăng nhập</AlertTitle>
            <AlertDescription>{loginResult.message}</AlertDescription>
          </Alert>
          <AdminRetryButton />
        </CardContent>
      </Card>
    </main>
  );
}
