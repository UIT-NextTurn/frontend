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

describe('POST /api/auth/logout', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080' };
  });

  afterEach(() => {
    mockCookieGet.mockReset();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('forwards server-side tokens to backend logout and clears all httpOnly session cookies', async () => {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === 'nt_access_token') {
        return { name, value: 'server-access-jwt' };
      }
      if (name === 'nt_refresh_token') {
        return { name, value: 'server-refresh-jwt' };
      }
      return undefined;
    });

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const response = await POST();
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('http://backend.internal:8080/api/v1/auth/logout');
    expect(calledInit?.method).toBe('POST');
    expect(calledInit?.body).toBe(JSON.stringify({ refreshToken: 'server-refresh-jwt' }));

    const headers = new Headers(calledInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer server-access-jwt');

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        redirectPath: '/login',
      },
    });

    const setCookies = response.headers.getSetCookie();
    expect(findSetCookie(setCookies, 'nt_access_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_refresh_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_session_meta')).toContain('Max-Age=0');
  });

  it('still clears local cookies cleanly when backend logout fails or tokens are missing', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const response = await POST();
    const body = await response.json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        redirectPath: '/login',
      },
    });

    const setCookies = response.headers.getSetCookie();
    expect(findSetCookie(setCookies, 'nt_access_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_refresh_token')).toContain('Max-Age=0');
    expect(findSetCookie(setCookies, 'nt_session_meta')).toContain('Max-Age=0');
  });
});
