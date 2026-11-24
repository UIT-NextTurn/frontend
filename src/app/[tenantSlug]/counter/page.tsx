import type { Metadata } from 'next';

import { renderTenantPortal } from '@/features/auth/tenant-portal-shell';

export const metadata: Metadata = {
  title: 'Nhân viên quầy — NextTurn',
};

export interface CounterRouteProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function CounterStaffPage({ params }: CounterRouteProps) {
  const { tenantSlug } = await params;
  return renderTenantPortal({ tenantSlug, requiredRole: 'COUNTER_STAFF' });
}
