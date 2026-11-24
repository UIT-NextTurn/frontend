import { AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPlatformAdminLoginUrl } from '@/features/auth/admin-entry-service';
import { AdminRetryButton } from '@/features/auth/admin-retry-button';
import { computePortalDestination } from '@/features/auth/auth-session.schema';
import { LogoutButton } from '@/features/auth/logout-button';
import { PortalAccessDenied } from '@/features/auth/portal-guard-view';
import { getServerSession } from '@/lib/auth/session-cookies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản trị viên nền tảng — NextTurn',
};

export default async function AdminPage() {
  const session = await getServerSession();

  if (session && session.primaryRole !== 'SUPERADMIN') {
    const authorizedPortal = computePortalDestination(session.primaryRole, session.tenantCode);
    return (
      <PortalAccessDenied
        authorizedPortal={authorizedPortal}
        message="Cổng Quản trị viên nền tảng chỉ dành cho tài khoản Quản trị viên nền tảng."
        theme="platform"
      />
    );
  }

  if (session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f19] px-4 py-8 text-[#f8fafc]">
        <Card className="w-full max-w-[540px] border-[#1e293b] bg-[#111827] text-[#f8fafc] shadow-none">
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-[#312e81] bg-[#1e1b4b] px-3 py-1 text-xs font-semibold text-[#a5b4fc]">
              Quản trị viên nền tảng
            </span>
            <CardTitle className="text-2xl text-[#f8fafc]">
              Không gian điều phối toàn nền tảng
            </CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Phiên làm việc Quản trị viên nền tảng đã được xác thực. Các phân hệ quản lý cơ sở và
              hạn mức sẽ hiển thị tại đây.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid gap-3 rounded-xl border border-[#1e293b] bg-[#0b0f19] p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#94a3b8]">Tài khoản</dt>
                <dd className="font-semibold text-[#f8fafc]">{session.fullName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#94a3b8]">Email</dt>
                <dd className="font-mono text-xs text-[#cbd5e1]">{session.email}</dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <LogoutButton
                variant="outline"
                className="border-[#334155] bg-[#1e293b] text-[#f8fafc] hover:bg-[#334155]"
              />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const loginResult = await fetchPlatformAdminLoginUrl();

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
