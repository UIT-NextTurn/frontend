/** @jest-environment node */

import { NextResponse } from 'next/server';

import {
  AUTH_COOKIE_NAMES,
  clearSessionCookies,
  getServerAuthCookies,
  getServerSession,
  normalizeMaxAge,
  setSessionCookies,
} from './session-cookies';

const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookieGet,
  })),
}));

function stubCookies(values: Record<string, string | undefined>) {
  mockCookieGet.mockImplementation((name: string) => {
    const value = values[name];
    return value === undefined ? undefined : { name, value };
  });
}

function findSetCookie(setCookies: string[], name: string): string | undefined {
  return setCookies.find((header) => header.startsWith(`${name}=`));
}

describe('normalizeMaxAge', () => {
  it('returns floored positive integer seconds and undefined for non-positive or non-finite inputs', () => {
    expect(normalizeMaxAge(300)).toBe(300);
    expect(normalizeMaxAge(59.9)).toBe(59);
    expect(normalizeMaxAge(0)).toBeUndefined();
    expect(normalizeMaxAge(-15)).toBeUndefined();
    expect(normalizeMaxAge(Number.NaN)).toBeUndefined();
    expect(normalizeMaxAge(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(normalizeMaxAge(Number.NEGATIVE_INFINITY)).toBeUndefined();
    expect(normalizeMaxAge(undefined)).toBeUndefined();
  });
});

describe('session cookie writers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('writes httpOnly cookies with floored maxAge when positive and omits Max-Age when invalid', () => {
    const responseWithExpiry = NextResponse.json({ ok: true });
    setSessionCookies(
      responseWithExpiry,
      {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresIn: 120.8,
        refreshExpiresIn: 3600.4,
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        roles: ['TENANT_ADMIN'],
        primaryRole: 'TENANT_ADMIN',
        tenantCode: 'pk-alpha',
      },
      {
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        primaryRole: 'TENANT_ADMIN',
        roles: ['TENANT_ADMIN'],
        tenantCode: 'pk-alpha',
      }
    );

    const setCookiesWithExpiry = responseWithExpiry.headers.getSetCookie();
    const accessCookie = findSetCookie(setCookiesWithExpiry, AUTH_COOKIE_NAMES.accessToken);
    const refreshCookie = findSetCookie(setCookiesWithExpiry, AUTH_COOKIE_NAMES.refreshToken);
    const metaCookie = findSetCookie(setCookiesWithExpiry, AUTH_COOKIE_NAMES.sessionMeta);

    expect(accessCookie).toContain('Max-Age=120');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie?.toLowerCase()).toContain('samesite=lax');
    expect(accessCookie).toContain('Path=/');
    expect(refreshCookie).toContain('Max-Age=3600');
    expect(metaCookie).toContain('Max-Age=3600');

    const responseWithoutExpiry = NextResponse.json({ ok: true });
    setSessionCookies(
      responseWithoutExpiry,
      {
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        expiresIn: 0,
        refreshExpiresIn: -5,
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        roles: ['TENANT_ADMIN'],
        primaryRole: 'TENANT_ADMIN',
        tenantCode: 'pk-alpha',
      },
      {
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        primaryRole: 'TENANT_ADMIN',
        roles: ['TENANT_ADMIN'],
        tenantCode: 'pk-alpha',
      }
    );

    const setCookiesWithoutExpiry = responseWithoutExpiry.headers.getSetCookie();
    expect(findSetCookie(setCookiesWithoutExpiry, AUTH_COOKIE_NAMES.accessToken)).not.toContain(
      'Max-Age='
    );
    expect(findSetCookie(setCookiesWithoutExpiry, AUTH_COOKIE_NAMES.refreshToken)).not.toContain(
      'Max-Age='
    );
    expect(findSetCookie(setCookiesWithoutExpiry, AUTH_COOKIE_NAMES.sessionMeta)).not.toContain(
      'Max-Age='
    );
  });

  it('expires all authentication cookies cleanly in clearSessionCookies', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };

    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);

    const setCookies = response.headers.getSetCookie();
    for (const cookieName of Object.values(AUTH_COOKIE_NAMES)) {
      const header = findSetCookie(setCookies, cookieName);
      expect(header).toContain(`${cookieName}=;`);
      expect(header).toContain('Max-Age=0');
      expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('Secure');
    }
  });
});

describe('server session cookie readers', () => {
  afterEach(() => {
    mockCookieGet.mockReset();
  });

  it('returns tokens and parsed staff session when access token and metadata cookies are valid', async () => {
    stubCookies({
      nt_access_token: 'access-jwt',
      nt_refresh_token: 'refresh-jwt',
      nt_session_meta: JSON.stringify({
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        primaryRole: 'TENANT_ADMIN',
        roles: ['TENANT_ADMIN'],
        tenantCode: 'pk-alpha',
      }),
    });

    const authCookies = await getServerAuthCookies();
    const session = await getServerSession();

    expect(authCookies).toEqual({
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
      session: {
        userId: 'u-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        primaryRole: 'TENANT_ADMIN',
        roles: ['TENANT_ADMIN'],
        tenantCode: 'pk-alpha',
      },
    });
    expect(session).toEqual(authCookies.session);
  });

  it('returns null session when metadata is missing, malformed, or lacks valid tenant destination', async () => {
    stubCookies({ nt_access_token: 'access-jwt' });
    expect(await getServerSession()).toBeNull();

    stubCookies({ nt_access_token: 'access-jwt', nt_session_meta: '{broken-json' });
    expect(await getServerSession()).toBeNull();

    stubCookies({
      nt_access_token: 'access-jwt',
      nt_session_meta: JSON.stringify({
        userId: 'u-2',
        email: 'x@pk.vn',
        fullName: 'Bad',
        primaryRole: 'TENANT_ADMIN',
        roles: ['TENANT_ADMIN'],
        tenantCode: null,
      }),
    });
    expect(await getServerSession()).toBeNull();
  });

  it('returns null from getServerSession when access token cookie is absent even if metadata exists', async () => {
    stubCookies({
      nt_refresh_token: 'refresh-jwt',
      nt_session_meta: JSON.stringify({
        userId: 'u-1',
        email: 'sa@nextturn.vn',
        fullName: 'Quản trị',
        primaryRole: 'SUPERADMIN',
        roles: ['SUPERADMIN'],
        tenantCode: null,
      }),
    });

    const cookiesResult = await getServerAuthCookies();
    expect(cookiesResult.refreshToken).toBe('refresh-jwt');
    expect(cookiesResult.session?.primaryRole).toBe('SUPERADMIN');
    expect(await getServerSession()).toBeNull();
  });
});
