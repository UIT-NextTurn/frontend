import type { Metadata } from 'next';

import { TenantSelectionForm } from '@/features/auth/tenant-selection-form';

export const metadata: Metadata = {
  title: 'Đăng nhập nhân sự — NextTurn',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <TenantSelectionForm />
    </main>
  );
}
