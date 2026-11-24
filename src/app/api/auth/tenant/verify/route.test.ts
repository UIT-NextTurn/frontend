/** @jest-environment node */

import { z } from 'zod';

import type { InactiveTenantStatus } from '@/features/auth/tenant-verify.schema';

import { POST } from './route';

const bffErrorBodySchema = z.object({
  success: z.literal(false),
  errorCode: z.string(),
  message: z.string(),
  tenantStatus: z.string().optional(),
  data: z.record(z.string(), z.string()).optional(),
});

async function parseErrorBody(response: Response) {
  return bffErrorBodySchema.parse(await response.json());
}

function parseErrorJson(rawBody: string) {
  return bffErrorBodySchema.parse(JSON.parse(rawBody));
}

const inactiveTenantStatuses: InactiveTenantStatus[] = [
  'PENDING_APPROVAL',
  'SUSPENDED',
  'REJECTED',
];

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
    const body = await parseErrorBody(response);

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
    const body = await parseErrorBody(response);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_002');
    expect(body.data?.tenantCode).toBeTruthy();
  });

  it.each(inactiveTenantStatuses)(
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
      const body = await parseErrorBody(response);

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
    const body = await parseErrorBody(response);

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_004');
    expect(body.tenantStatus).toBeUndefined();
  });

  it.each([['unexpected'], { count: 42, nested: ['x'] }])(
    'maps 403 AUTH_004 cleanly when upstream data is non-string payload %p',
    async (nonStringData) => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            success: false,
            errorCode: 'AUTH_004',
            message: 'Tenant facility is not active. Current status: SUSPENDED',
            data: nonStringData,
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
      const body = await parseErrorBody(response);

      expect(response.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('AUTH_004');
      expect(body.tenantStatus).toBe('SUSPENDED');
      expect(body.data).toBeUndefined();
    }
  );

  it('normalizes 404 AUTH_003 unknown tenant response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 404,
          success: false,
          errorCode: 'AUTH_003',
          message: 'Tenant not found',
          data: null,
        }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'unknown-clinic' }),
    });

    const response = await POST(request);
    const body = await parseErrorBody(response);

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_003');
  });

  it('normalizes 400 SYS_002 validation response preserving data.tenantCode', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 400,
          success: false,
          errorCode: 'SYS_002',
          message: 'Validation failed',
          data: { tenantCode: 'Mã cơ sở phải từ 3 đến 30 ký tự' },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'pk-alpha' }),
    });

    const response = await POST(request);
    const body = await parseErrorBody(response);

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_002');
    expect(body.data).toEqual({ tenantCode: 'Mã cơ sở phải từ 3 đến 30 ký tự' });
  });

  it('normalizes 400 AUTH_009 header/body mismatch error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 400,
          success: false,
          errorCode: 'AUTH_009',
          message: 'Tenant header mismatch',
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    );

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'pk-alpha' }),
    });

    const response = await POST(request);
    const body = await parseErrorBody(response);

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTH_009');
  });

  it.each([
    { upstreamStatus: 500, upstreamCode: 'AUTH_012', expectedStatus: 502 },
    { upstreamStatus: 503, upstreamCode: 'AUTH_011', expectedStatus: 503 },
  ])(
    'normalizes upstream $upstreamStatus $upstreamCode without leaking backend URL',
    async ({ upstreamStatus, upstreamCode, expectedStatus }) => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: upstreamStatus,
            success: false,
            errorCode: upstreamCode,
            message: 'Keycloak error at http://backend.internal:8080',
          }),
          { status: upstreamStatus, headers: { 'content-type': 'application/json' } }
        )
      );

      const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantCode: 'pk-alpha' }),
      });

      const response = await POST(request);
      const rawBody = await response.text();
      const body = parseErrorJson(rawBody);

      expect(response.status).toBe(expectedStatus);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe(upstreamCode);
      expect(rawBody).not.toContain('backend.internal');
    }
  );

  it('returns 503 SYS_001 without leaking NEXTTURN_BACKEND_URL when backend is unreachable', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED http://backend.internal:8080'));

    const request = new Request('http://localhost:3000/api/auth/tenant/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantCode: 'pk-alpha' }),
    });

    const response = await POST(request);
    const rawBody = await response.text();
    const body = parseErrorJson(rawBody);

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_001');
    expect(rawBody).not.toContain('backend.internal');
  });
});
