import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminPage from './page';

const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockRefresh = jest.fn();
const mockReplace = jest.fn();
const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookieGet,
  })),
}));

jest.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
  useRouter: () => ({
    refresh: mockRefresh,
    replace: mockReplace,
  }),
}));

function stubAdminSessionCookie(session: {
  userId: string;
  email: string;
  fullName: string;
  primaryRole: 'SUPERADMIN' | 'TENANT_ADMIN' | 'COUNTER_STAFF';
  roles: string[];
  tenantCode: string | null;
}) {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === 'nt_access_token') {
      return { name, value: 'active-jwt' };
    }
    if (name === 'nt_session_meta') {
      return { name, value: JSON.stringify(session) };
    }
    return undefined;
  });
}

describe('/admin unauthenticated Platform Administrator entry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTTURN_BACKEND_URL: 'http://backend.internal:8080' };
    mockCookieGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    mockCookieGet.mockReset();
    mockRedirect.mockClear();
    mockRefresh.mockReset();
    mockReplace.mockReset();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('calls backend GET /api/v1/auth/superadmin/login-url without X-Tenant-Code and redirects to Keycloak', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            tenantId: null,
            tenantCode: null,
            tenantName: null,
            status: 'ACTIVE',
            organisationId: null,
            loginUrl:
              'https://sso.nextturn.local/realms/superadmin/protocol/openid-connect/auth?client_id=nextturn',
            allowedRoles: ['SUPERADMIN'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(AdminPage()).rejects.toThrow(
      'NEXT_REDIRECT:https://sso.nextturn.local/realms/superadmin/protocol/openid-connect/auth?client_id=nextturn'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('http://backend.internal:8080/api/v1/auth/superadmin/login-url');
    expect(calledInit?.method).toBe('GET');
    expect(new Headers(calledInit?.headers).has('X-Tenant-Code')).toBe(false);
    expect(mockRedirect).toHaveBeenCalledWith(
      'https://sso.nextturn.local/realms/superadmin/protocol/openid-connect/auth?client_id=nextturn'
    );
  });

  it('renders Platform Command dark fallback with retry action and zero Tenant Selection UI when backend fails', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    const ui = await AdminPage();
    render(ui);

    const main = screen.getByRole('main');
    expect(main.className).toContain('bg-[#0b0f19]');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Quản trị viên nền tảng/i })
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryButton.className).toContain('bg-[#6366f1]');
    await user.click(retryButton);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(/Đổi mã cơ sở/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mã cơ sở/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Quay lại chọn cơ sở/i })).not.toBeInTheDocument();
  });

  it('rejects non-http(s) superadmin loginUrl and shows dark fallback without redirecting', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            tenantId: null,
            tenantCode: null,
            status: 'ACTIVE',
            loginUrl: 'javascript:alert(1)',
            allowedRoles: ['SUPERADMIN'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const ui = await AdminPage();
    render(ui);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Đổi mã cơ sở/i)).not.toBeInTheDocument();
  });

  it('shows dark fallback when NEXTTURN_BACKEND_URL is missing, upstream returns 503, or JSON is invalid', async () => {
    delete process.env.NEXTTURN_BACKEND_URL;
    const missingEnvUi = await AdminPage();
    const { unmount } = render(missingEnvUi);
    expect(screen.getByRole('alert')).toHaveTextContent('chưa được cấu hình đầy đủ');
    unmount();

    process.env.NEXTTURN_BACKEND_URL = 'http://backend.internal:8080';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }));

    const upstreamErrorUi = await AdminPage();
    const secondRender = render(upstreamErrorUi);
    expect(screen.getByRole('alert')).toHaveTextContent('tạm thời gián đoạn');
    secondRender.unmount();

    const invalidJsonUi = await AdminPage();
    render(invalidJsonUi);
    expect(screen.getByRole('alert')).toHaveTextContent('Phản hồi cấu hình đăng nhập không hợp lệ');
  });

  it('renders Platform Command dark placeholder for authenticated SUPERADMIN with working Đăng xuất and zero Đổi mã cơ sở', async () => {
    const user = userEvent.setup();
    stubAdminSessionCookie({
      userId: 'sa-1',
      email: 'super@nextturn.vn',
      fullName: 'Quản trị nền tảng',
      primaryRole: 'SUPERADMIN',
      roles: ['SUPERADMIN'],
      tenantCode: null,
    });

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { redirectPath: '/login' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const ui = await AdminPage();
    render(ui);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    const main = screen.getByRole('main');
    expect(main.className).toContain('bg-[#0b0f19]');
    expect(screen.getByText('Quản trị viên nền tảng')).toBeInTheDocument();
    expect(screen.getByText('Quản trị nền tảng')).toBeInTheDocument();
    expect(screen.getByText('super@nextturn.vn')).toBeInTheDocument();
    expect(screen.queryByText(/Đổi mã cơ sở/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it.each([
    {
      primaryRole: 'TENANT_ADMIN' as const,
      tenantCode: 'pk-alpha',
      expectedHref: '/pk-alpha/tenant',
    },
    {
      primaryRole: 'COUNTER_STAFF' as const,
      tenantCode: 'pk-beta',
      expectedHref: '/pk-beta/counter',
    },
  ])(
    'blocks authenticated $primaryRole on /admin with 403 dark view linking to $expectedHref and zero Đổi mã cơ sở',
    async ({ primaryRole, tenantCode, expectedHref }) => {
      stubAdminSessionCookie({
        userId: 'staff-1',
        email: 'staff@pk.vn',
        fullName: 'Nhân sự cơ sở',
        primaryRole,
        roles: [primaryRole],
        tenantCode,
      });
      const fetchSpy = jest.spyOn(global, 'fetch');

      const ui = await AdminPage();
      render(ui);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(screen.getByRole('main').className).toContain('bg-[#0b0f19]');
      expect(screen.getByRole('alert')).toHaveTextContent('403');
      expect(screen.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
        'href',
        expectedHref
      );
      expect(screen.queryByText(/Đổi mã cơ sở/i)).not.toBeInTheDocument();
    }
  );
});
