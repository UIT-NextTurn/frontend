/** @jest-environment node */

import { getServerAuthCookies, getServerSession } from './session-cookies';

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
