/** @jest-environment node */

import { POST } from './route';

describe('POST /api/auth/tenant/verify', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080' };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('validates tenantCode, calls backend without X-Tenant-Code, and returns normalized ACTIVE payload', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          timestamp: '2026-11-15 08:00:00',
          status: 200,
          success: true,
          message: 'OK',
          data: {
            tenantId: 't-1',
            tenantCode: 'pk-alpha',
            tenantName: 'Phòng khám Alpha',
            status: 'ACTIVE',
            organisationId: 'org-1',
            loginUrl:
              'https://sso.nextturn.local/realms/nextturn/protocol/openid-connect/auth?client_id=nextturn',
            allowedRoles: ['TENANT_ADMIN', 'COUNTER_STAFF'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: '  pk-alpha  ' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('http://backend.internal:8080/api/v1/auth/tenant/verify');
    expect(calledInit?.method).toBe('POST');
    expect(calledInit?.body).toBe(JSON.stringify({ tenantCode: 'pk-alpha' }));

    const headers = new Headers(calledInit?.headers);
    expect(headers.has('X-Tenant-Code')).toBe(false);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        tenantId: 't-1',
        tenantCode: 'pk-alpha',
        tenantName: 'Phòng khám Alpha',
        status: 'ACTIVE',
        organisationId: 'org-1',
        loginUrl:
          'https://sso.nextturn.local/realms/nextturn/protocol/openid-connect/auth?client_id=nextturn',
        allowedRoles: ['TENANT_ADMIN', 'COUNTER_STAFF'],
      },
    });
  });

  it('rejects unsafe non-http(s) loginUrl returned by backend with 502', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 200,
          success: true,
          message: 'OK',
          data: {
            tenantId: 't-1',
            tenantCode: 'pk-alpha',
            tenantName: 'Phòng khám Alpha',
            status: 'ACTIVE',
            organisationId: 'org-1',
            loginUrl: 'javascript:alert(1)',
            allowedRoles: ['TENANT_ADMIN'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'pk-alpha' }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { success: boolean; errorCode?: string };

    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_012');
  });

  it('rejects malformed client tenantCode with 400 SYS_002 without calling backend', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'PK_INVALID' }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      errorCode?: string;
      data?: Record<string, string>;
    };

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_002');
    expect(body.data?.tenantCode).toBeTruthy();
  });

  it.each(['PENDING_APPROVAL', 'SUSPENDED', 'REJECTED'] as const)(
    'intercepts 403 AUTH_004 and extracts inactive tenantStatus %s without loginUrl',
    async (tenantStatus) => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            success: false,
            errorCode: 'AUTH_004',
            message: `Tenant facility is not active. Current status: ${tenantStatus}`,
            data: null,
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        )
      );

      const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantCode: 'pk-alpha' }),
      });

      const response = await POST(request);
      const body = (await response.json()) as {
        success: boolean;
        errorCode?: string;
        tenantStatus?: string;
        data?: unknown;
      };

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('AUTH_004');
      expect(body.tenantStatus).toBe(tenantStatus);
      expect(body.data).toBeUndefined();
    }
  );

  it('handles 403 AUTH_004 cleanly when status token is absent from message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 403,
          success: false,
          errorCode: 'AUTH_004',
          message: 'Tenant facility is not active.',
          data: null,
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'pk-alpha' }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      errorCode?: string;
      tenantStatus?: string;
    };

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_004');
    expect(body.tenantStatus).toBeUndefined();
  });
});
