/** @jest-environment node */

import { POST } from './route';

function findSetCookie(setCookies: string[], name: string): string | undefined {
  return setCookies.find((header) => header.startsWith(`${name}=`));
}

describe('POST /api/auth/token', () => {
  const originalEnv = process.env;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080' };
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalNodeEnv,
      configurable: true,
      writable: true,
    });
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('exchanges code, sets httpOnly session cookies, ignores targetDashboardUrl, and strips tokens from JSON', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          success: true,
          message: 'OK',
          data: {
            accessToken: 'raw-access-jwt',
            refreshToken: 'raw-refresh-jwt',
            idToken: 'raw-id-jwt',
            tokenType: 'Bearer',
            expiresIn: 300,
            refreshExpiresIn: 1800,
            userId: 'user-1',
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

    const request = new Request('http://localhost:3000/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'auth-code-123',
        redirectUri: 'http://localhost:3000/auth/callback',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('http://backend.internal:8080/api/v1/auth/token');
    expect(calledInit?.method).toBe('POST');
    expect(calledInit?.body).toBe(
      JSON.stringify({
        code: 'auth-code-123',
        redirectUri: 'http://localhost:3000/auth/callback',
      })
    );

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        user: {
          userId: 'user-1',
          email: 'admin@pk-alpha.vn',
          fullName: 'Nguyễn Văn An',
          primaryRole: 'TENANT_ADMIN',
          roles: ['TENANT_ADMIN'],
          tenantCode: 'pk-alpha',
        },
        redirectPath: '/pk-alpha/tenant',
      },
    });
    expect(JSON.stringify(body)).not.toContain('raw-access-jwt');
    expect(JSON.stringify(body)).not.toContain('raw-refresh-jwt');
    expect(JSON.stringify(body)).not.toContain('raw-id-jwt');
    expect(JSON.stringify(body)).not.toContain('/tenant/dashboard');

    const setCookies = response.headers.getSetCookie();
    const accessCookie = findSetCookie(setCookies, 'nt_access_token');
    const refreshCookie = findSetCookie(setCookies, 'nt_refresh_token');
    const metaCookie = findSetCookie(setCookies, 'nt_session_meta');

    expect(accessCookie).toContain('raw-access-jwt');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie?.toLowerCase()).toContain('samesite=lax');
    expect(accessCookie).toContain('Path=/');

    expect(refreshCookie).toContain('raw-refresh-jwt');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie?.toLowerCase()).toContain('samesite=lax');
    expect(refreshCookie).toContain('Path=/');

    expect(metaCookie).toContain('HttpOnly');
    expect(metaCookie?.toLowerCase()).toContain('samesite=lax');
    expect(metaCookie).toContain('Path=/');
  });

  it('sets Secure cookie attribute in production and computes /admin and /counter routes', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
      writable: true,
    });

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'sa-access',
              refreshToken: 'sa-refresh',
              userId: 'sa-1',
              email: 'super@nextturn.vn',
              fullName: 'Quản trị nền tảng',
              roles: ['SUPERADMIN'],
              primaryRole: 'SUPERADMIN',
              tenantCode: null,
              targetDashboardUrl: '/admin/dashboard',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'cs-access',
              refreshToken: 'cs-refresh',
              userId: 'cs-1',
              email: 'counter@pk-alpha.vn',
              fullName: 'Lê Minh',
              roles: ['COUNTER_STAFF'],
              primaryRole: 'COUNTER_STAFF',
              tenantCode: 'pk-alpha',
              targetDashboardUrl: '/staff/counter',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const saResponse = await POST(
      new Request('https://nextturn.vn/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'sa-code' }),
      })
    );
    const saBody = await saResponse.json();
    expect(saResponse.status).toBe(200);
    expect(saBody.data.redirectPath).toBe('/admin');
    expect(findSetCookie(saResponse.headers.getSetCookie(), 'nt_access_token')).toContain('Secure');

    const csResponse = await POST(
      new Request('https://nextturn.vn/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'cs-code' }),
      })
    );
    const csBody = await csResponse.json();
    expect(csResponse.status).toBe(200);
    expect(csBody.data.redirectPath).toBe('/pk-alpha/counter');
  });

  it('clears cookies and fails safely with 502 AUTH_012 when tenant role lacks tenantCode', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'bad-access',
            refreshToken: 'bad-refresh',
            userId: 'u-bad',
            email: 'broken@nextturn.vn',
            fullName: 'Broken User',
            roles: ['TENANT_ADMIN'],
            primaryRole: 'TENANT_ADMIN',
            tenantCode: null,
            targetDashboardUrl: '/tenant/dashboard',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await POST(
      new Request('http://localhost:3000/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'broken-code' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_012');

    const setCookies = response.headers.getSetCookie();
    expect(findSetCookie(setCookies, 'nt_access_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_refresh_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_session_meta')).toContain('Max-Age=0');
  });

  it('returns 400 SYS_002 when authorization code is missing', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const response = await POST(
      new Request('http://localhost:3000/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '' }),
      })
    );
    const body = await response.json();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_002');
  });

  it('returns 400 SYS_002 on malformed JSON body and 503 SYS_001 when NEXTTURN_BACKEND_URL is missing', async () => {
    const badJsonResponse = await POST(
      new Request('http://localhost:3000/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json',
      })
    );
    expect(badJsonResponse.status).toBe(400);

    delete process.env.NEXTTURN_BACKEND_URL;
    const noEnvResponse = await POST(
      new Request('http://localhost:3000/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'abc' }),
      })
    );
    expect(noEnvResponse.status).toBe(503);
  });

  it('clears session cookies on network error, non-JSON upstream 503, and malformed success payload', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { unexpected: true } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    const reqInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'code-1' }),
    };

    const netResponse = await POST(new Request('http://localhost:3000/api/auth/token', reqInit));
    expect(netResponse.status).toBe(503);
    expect(findSetCookie(netResponse.headers.getSetCookie(), 'nt_access_token')).toContain(
      'Max-Age=0'
    );

    const badUpstreamResponse = await POST(
      new Request('http://localhost:3000/api/auth/token', reqInit)
    );
    expect(badUpstreamResponse.status).toBe(503);
    expect(findSetCookie(badUpstreamResponse.headers.getSetCookie(), 'nt_refresh_token')).toContain(
      'Max-Age=0'
    );

    const badPayloadResponse = await POST(
      new Request('http://localhost:3000/api/auth/token', reqInit)
    );
    expect(badPayloadResponse.status).toBe(502);
    expect(findSetCookie(badPayloadResponse.headers.getSetCookie(), 'nt_session_meta')).toContain(
      'Max-Age=0'
    );
  });

  it.each([
    {
      status: 401,
      errorCode: 'AUTH_005',
      backendMessage: 'Invalid or expired authorization code',
      expectedText: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
    },
    {
      status: 401,
      errorCode: 'AUTH_007',
      backendMessage: 'Malformed JWT token',
      expectedText: 'Phiên xác thực không hợp lệ',
    },
    {
      status: 403,
      errorCode: 'AUTH_010',
      backendMessage: 'END_USER is not permitted on staff portal',
      expectedText: 'Tài khoản khách hàng không có quyền truy cập cổng quản lý nhân sự',
    },
    {
      status: 403,
      errorCode: 'AUTH_004',
      backendMessage: 'Tenant is not active. Current status: SUSPENDED',
      expectedText: 'Cơ sở hiện chưa sẵn sàng hoạt động',
    },
    {
      status: 404,
      errorCode: 'AUTH_003',
      backendMessage: 'Tenant not found',
      expectedText: 'Không tìm thấy cơ sở',
    },
    {
      status: 503,
      errorCode: 'AUTH_011',
      backendMessage: 'Keycloak unavailable',
      expectedText: 'Dịch vụ đăng nhập Keycloak hiện tạm thời gián đoạn',
    },
  ])(
    'maps backend $status $errorCode rejection to Vietnamese message and clears auth cookies',
    async ({ status, errorCode, backendMessage, expectedText }) => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errorCode,
            message: backendMessage,
          }),
          { status, headers: { 'content-type': 'application/json' } }
        )
      );

      const response = await POST(
        new Request('http://localhost:3000/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'rejected-code' }),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe(errorCode);
      expect(body.message).toContain(expectedText);

      const setCookies = response.headers.getSetCookie();
      expect(findSetCookie(setCookies, 'nt_access_token')).toContain('Max-Age=0');
      expect(findSetCookie(setCookies, 'nt_refresh_token')).toContain('Max-Age=0');
      expect(findSetCookie(setCookies, 'nt_session_meta')).toContain('Max-Age=0');
    }
  );
});
