import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

import {
  authUserSummarySchema,
  type AuthUserSummary,
  type BackendAuthTokenData,
  computePortalDestination,
} from '@/features/auth/auth-session.schema';

export const AUTH_COOKIE_NAMES = {
  accessToken: 'nt_access_token',
  refreshToken: 'nt_refresh_token',
  sessionMeta: 'nt_session_meta',
} as const;

export interface ServerAuthCookies {
  accessToken: string | null;
  refreshToken: string | null;
  session: AuthUserSummary | null;
}

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };
}

/**
 * Normalizes cookie maxAge seconds, returning undefined when absent or non-positive.
 */
export function normalizeMaxAge(seconds: number | undefined): number | undefined {
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

  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, tokenData.accessToken, {
    ...baseOptions,
    ...(accessMaxAge ? { maxAge: accessMaxAge } : {}),
  });

  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, tokenData.refreshToken, {
    ...baseOptions,
    ...(refreshMaxAge ? { maxAge: refreshMaxAge } : {}),
  });

  response.cookies.set(AUTH_COOKIE_NAMES.sessionMeta, JSON.stringify(summary), {
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

  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, '', expiredOptions);
  response.cookies.set(AUTH_COOKIE_NAMES.refreshToken, '', expiredOptions);
  response.cookies.set(AUTH_COOKIE_NAMES.sessionMeta, '', expiredOptions);
}

/**
 * Parses server-side request cookies without exposing token values to client components.
 */
export async function getServerAuthCookies(): Promise<ServerAuthCookies> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value?.trim() || null;
  const refreshToken = cookieStore.get(AUTH_COOKIE_NAMES.refreshToken)?.value?.trim() || null;
  const rawMeta = cookieStore.get(AUTH_COOKIE_NAMES.sessionMeta)?.value;

  if (!rawMeta) {
    return { accessToken, refreshToken, session: null };
  }

  try {
    const parsedJson: unknown = JSON.parse(rawMeta);
    const parsedSession = authUserSummarySchema.safeParse(parsedJson);
    if (!parsedSession.success) {
      return { accessToken, refreshToken, session: null };
    }

    const destination = computePortalDestination(
      parsedSession.data.primaryRole,
      parsedSession.data.tenantCode
    );
    if (!destination) {
      return { accessToken, refreshToken, session: null };
    }

    return {
      accessToken,
      refreshToken,
      session: parsedSession.data,
    };
  } catch {
    return { accessToken, refreshToken, session: null };
  }
}

/**
 * Returns authenticated staff user metadata when access token and session cookies are present.
 */
export async function getServerSession(): Promise<AuthUserSummary | null> {
  const { accessToken, session } = await getServerAuthCookies();
  if (!accessToken || !session) {
    return null;
  }

  return session;
}
