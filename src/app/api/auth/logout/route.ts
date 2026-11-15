import { NextResponse } from 'next/server';

import { clearSessionCookies, getServerAuthCookies } from '@/lib/auth/session-cookies';
import { getServerEnv } from '@/lib/env';

export async function POST() {
  const { accessToken, refreshToken } = await getServerAuthCookies();

  try {
    const { backendUrl } = getServerEnv();
    await fetch(`${backendUrl}/api/v1/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
  } catch {
    // Clearing local session cookies must succeed even if backend logout fails.
  }

  const response = NextResponse.json(
    {
      success: true,
      data: {
        redirectPath: '/login',
      },
    },
    { status: 200 }
  );

  clearSessionCookies(response);
  return response;
}
