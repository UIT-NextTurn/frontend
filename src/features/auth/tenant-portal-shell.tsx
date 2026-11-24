import 'server-only';

import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { computePortalDestination } from '@/features/auth/auth-session.schema';
import { LogoutButton } from '@/features/auth/logout-button';
import { PortalAccessDenied } from '@/features/auth/portal-guard-view';
import { getServerSession } from '@/lib/auth/session-cookies';

export interface TenantPortalOptions {
  tenantSlug: string;
  requiredRole: 'TENANT_ADMIN' | 'COUNTER_STAFF';
}

const portalRoleCopy: Record<
  TenantPortalOptions['requiredRole'],
  { badge: string; heading: string; description: string }
> = {
  TENANT_ADMIN: {
    badge: 'Quản trị viên cơ sở',
    heading: 'Không gian quản trị cơ sở',
    description:
      'Phiên đăng nhập Quản trị viên cơ sở đã được xác thực. Các phân hệ cấu hình dịch vụ, nhân sự và lịch làm việc sẽ hiển thị tại đây.',
  },
  COUNTER_STAFF: {
    badge: 'Nhân viên quầy',
    heading: 'Không gian vận hành quầy phục vụ',
    description:
      'Phiên đăng nhập Nhân viên quầy đã được xác thực. Bảng điều phối hàng đợi và tiếp nhận khách sẽ hiển thị tại đây.',
  },
};

/**
 * Enforces authenticated Tenant-scoped role access and renders the Operational placeholder view.
 */
export async function renderTenantPortal({ tenantSlug, requiredRole }: TenantPortalOptions) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  if (session.primaryRole !== requiredRole || session.tenantCode !== tenantSlug) {
    const authorizedPortal = computePortalDestination(session.primaryRole, session.tenantCode);
    const denialMessage =
      session.primaryRole !== 'SUPERADMIN' && session.tenantCode !== tenantSlug
        ? 'Tài khoản này thuộc cơ sở khác và không có quyền truy cập mã cơ sở đang chọn.'
        : 'Vai trò hiện tại không có quyền mở cổng làm việc này.';

    return (
      <PortalAccessDenied
        authorizedPortal={authorizedPortal}
        message={denialMessage}
        theme="operational"
      />
    );
  }

  const copy = portalRoleCopy[requiredRole];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <Card className="w-full max-w-[540px]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
              {copy.badge}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 font-mono text-xs text-[#334155]">
              <span>Mã cơ sở:</span>
              <strong className="font-semibold text-[#0f172a]">{session.tenantCode}</strong>
            </span>
          </div>
          <CardTitle className="text-2xl">{copy.heading}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#475569]">Nhân sự</dt>
              <dd className="font-semibold text-[#0f172a]">{session.fullName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#475569]">Email</dt>
              <dd className="font-mono text-xs text-[#334155]">{session.email}</dd>
            </div>
          </dl>

          <div className="flex justify-end">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
