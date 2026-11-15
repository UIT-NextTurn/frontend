import 'server-only';

import type { NextResponse } from 'next/server';

import type { AuthUserSummary, BackendAuthTokenData } from '@/features/auth/auth-session.schema';

export const authCookieNames = {
  accessToken: 'nt_access_token',
  refreshToken: 'nt_refresh_token',
  sessionMeta: 'nt_session_meta',
} as const;

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
}

function normalizeMaxAge(seconds: number | undefined): number | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return Math.floor(seconds);
}

/**
 * Writes accessToken, refreshToken, and session metadata into httpOnly cookies.
 */
export function setSessionCookies(
  response: NextResponse,
  tokenData: BackendAuthTokenData,
  summary: AuthUserSummary
): void {
  const baseOptions = getBaseCookieOptions();
  const accessMaxAge = normalizeMaxAge(tokenData.expiresIn);
  const refreshMaxAge = normalizeMaxAge(tokenData.refreshExpiresIn);

  response.cookies.set(authCookieNames.accessToken, tokenData.accessToken, {
    ...baseOptions,
    ...(accessMaxAge ? { maxAge: accessMaxAge } : {}),
  });

  response.cookies.set(authCookieNames.refreshToken, tokenData.refreshToken, {
    ...baseOptions,
    ...(refreshMaxAge ? { maxAge: refreshMaxAge } : {}),
  });

  response.cookies.set(authCookieNames.sessionMeta, JSON.stringify(summary), {
    ...baseOptions,
    ...(refreshMaxAge ? { maxAge: refreshMaxAge } : {}),
  });
}

/**
 * Expires all authentication and session metadata cookies cleanly.
 */
export function clearSessionCookies(response: NextResponse): void {
  const expiredOptions = {
    ...getBaseCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set(authCookieNames.accessToken, '', expiredOptions);
  response.cookies.set(authCookieNames.refreshToken, '', expiredOptions);
  response.cookies.set(authCookieNames.sessionMeta, '', expiredOptions);
}
