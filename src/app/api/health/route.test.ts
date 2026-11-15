/** @jest-environment node */

import { GET } from './route';

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080/' };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('forwards to backend /api/v1/health and returns normalized UP payload', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          timestamp: '2026-11-15 08:00:00',
          status: 200,
          success: true,
          message: 'OK',
          data: {
            status: 'UP',
            system: 'nextturn-backend',
            version: '1.0.0',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const response = await GET();
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://backend.internal:8080/api/v1/health',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
      })
    );
    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        status: 'UP',
        system: 'nextturn-backend',
        version: '1.0.0',
      },
    });
  });

  it('returns 503 error envelope without leaking NEXTTURN_BACKEND_URL when backend is unreachable', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED http://backend.internal:8080'));

    const response = await GET();
    const rawBody = await response.text();
    const body = JSON.parse(rawBody) as { success: boolean; errorCode?: string; message?: string };

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_001');
    expect(body.message).toBeTruthy();
    expect(rawBody).not.toContain('backend.internal');
  });

  it('returns 502 error envelope when upstream returns 5xx or invalid health payload', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('bad gateway', { status: 500 }));

    const response = await GET();
    const body = (await response.json()) as { success: boolean; errorCode?: string };

    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_001');
  });

  it('returns 503 error envelope when NEXTTURN_BACKEND_URL is missing or invalid', async () => {
    process.env.NEXTTURN_BACKEND_URL = 'ftp://secret.internal';

    const response = await GET();
    const rawBody = await response.text();
    const body = JSON.parse(rawBody) as { success: boolean; errorCode?: string };

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('SYS_001');
    expect(rawBody).not.toContain('secret.internal');
  });
});
