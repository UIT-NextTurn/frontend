/** @jest-environment node */

import { POST } from './route';

const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookieGet,
  })),
}));

function findSetCookie(setCookies: string[], name: string): string | undefined {
  return setCookies.find((header) => header.startsWith(`${name}=`));
}

describe('POST /api/auth/refresh', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080' };
  });

  afterEach(() => {
    mockCookieGet.mockReset();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns 401 without calling backend when refresh token cookie is absent', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const response = await POST();
    const body = await response.json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_005');
    expect(findSetCookie(response.headers.getSetCookie(), 'nt_access_token')).toContain(
      'Max-Age=0'
    );
  });

  it('reads httpOnly refreshToken, calls backend refresh, rotates cookies, and strips raw tokens from JSON', async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === 'nt_refresh_token' ? { name, value: 'old-refresh-jwt' } : undefined
    );

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'new-access-jwt',
            refreshToken: 'new-refresh-jwt',
            expiresIn: 300,
            refreshExpiresIn: 1800,
            userId: 'u-1',
            email: 'admin@pk-alpha.vn',
            fullName: 'Nguyễn Văn An',
            roles: ['TENANT_ADMIN'],
            primaryRole: 'TENANT_ADMIN',
            tenantCode: 'pk-alpha',
            targetDashboardUrl: '/tenant/dashboard',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await POST();
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('http://backend.internal:8080/api/v1/auth/refresh');
    expect(calledInit?.method).toBe('POST');
    expect(calledInit?.body).toBe(JSON.stringify({ refreshToken: 'old-refresh-jwt' }));

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        user: {
          userId: 'u-1',
          email: 'admin@pk-alpha.vn',
          fullName: 'Nguyễn Văn An',
          primaryRole: 'TENANT_ADMIN',
          roles: ['TENANT_ADMIN'],
          tenantCode: 'pk-alpha',
        },
        redirectPath: '/pk-alpha/tenant',
      },
    });
    expect(JSON.stringify(body)).not.toContain('new-access-jwt');
    expect(JSON.stringify(body)).not.toContain('new-refresh-jwt');

    const setCookies = response.headers.getSetCookie();
    const accessCookie = findSetCookie(setCookies, 'nt_access_token');
    const refreshCookie = findSetCookie(setCookies, 'nt_refresh_token');
    expect(accessCookie).toContain('new-access-jwt');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie?.toLowerCase()).toContain('samesite=lax');
    expect(refreshCookie).toContain('new-refresh-jwt');
    expect(refreshCookie).toContain('HttpOnly');
  });

  it.each([
    { status: 401, errorCode: 'AUTH_008', expected: 'Phiên đăng nhập đã hết hạn' },
    { status: 401, errorCode: 'AUTH_005', expected: 'Mã xác thực không hợp lệ' },
    { status: 403, errorCode: 'AUTH_004', expected: 'Cơ sở hiện chưa sẵn sàng' },
  ])(
    'clears stale session cookies when backend refresh rejects with $status $errorCode',
    async ({ status, errorCode, expected }) => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'nt_refresh_token' ? { name, value: 'stale-refresh-jwt' } : undefined
      );

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errorCode,
            message: 'Rejected',
          }),
          { status, headers: { 'content-type': 'application/json' } }
        )
      );

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body.errorCode).toBe(errorCode);
      expect(body.message).toContain(expected);

      const setCookies = response.headers.getSetCookie();
      expect(findSetCookie(setCookies, 'nt_access_token')).toContain('Max-Age=0');
      expect(findSetCookie(setCookies, 'nt_refresh_token')).toContain('Max-Age=0');
      expect(findSetCookie(setCookies, 'nt_session_meta')).toContain('Max-Age=0');
    }
  );

  it('preserves session cookies on transient 503 Keycloak outage', async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === 'nt_refresh_token' ? { name, value: 'valid-refresh-jwt' } : undefined
    );

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'AUTH_011',
          message: 'Keycloak down',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await POST();
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
