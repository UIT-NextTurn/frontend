import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CallbackProcessingCard, OidcCallbackClient } from '@/features/auth/oidc-callback-client';

export const metadata: Metadata = {
  title: 'Đang xác thực đăng nhập — NextTurn',
};

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <Suspense fallback={<CallbackProcessingCard />}>
        <OidcCallbackClient />
      </Suspense>
    </main>
  );
}
