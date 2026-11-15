import type { Metadata } from 'next';

import { renderTenantPortal } from '@/features/auth/tenant-portal-shell';

export const metadata: Metadata = {
  title: 'Quản trị viên cơ sở — NextTurn',
};

export interface TenantRouteProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantAdminPage({ params }: TenantRouteProps) {
  const { tenantSlug } = await params;
  return renderTenantPortal({ tenantSlug, requiredRole: 'TENANT_ADMIN' });
}
