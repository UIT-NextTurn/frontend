import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { computePortalDestination } from '@/features/auth/auth-session.schema';
import { TenantSelectionForm } from '@/features/auth/tenant-selection-form';
import { getServerSession } from '@/lib/auth/session-cookies';

export const metadata: Metadata = {
  title: 'Đăng nhập nhân sự — NextTurn',
};

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    const destination = computePortalDestination(session.primaryRole, session.tenantCode);
    if (destination) {
      redirect(destination);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <TenantSelectionForm />
    </main>
  );
}
