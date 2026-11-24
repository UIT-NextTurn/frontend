import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppProviders } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'NextTurn — Quản lý hàng đợi & Đặt lịch hẹn',
  description: 'Cổng quản lý hàng đợi và đặt lịch hẹn đa cơ sở NextTurn.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#f8fafc] font-sans text-[#0f172a] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
