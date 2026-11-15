import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TenantAdminPage from './page';

const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookieGet,
  })),
}));

jest.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
  useRouter: () => ({
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}));

function stubSessionCookie(session: {
  userId: string;
  email: string;
  fullName: string;
  primaryRole: 'SUPERADMIN' | 'TENANT_ADMIN' | 'COUNTER_STAFF';
  roles: string[];
  tenantCode: string | null;
}) {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === 'nt_access_token') {
      return { name, value: 'valid-access-jwt' };
    }
    if (name === 'nt_session_meta') {
      return { name, value: JSON.stringify(session) };
    }
    return undefined;
  });
}

describe('/[tenantSlug]/tenant guard and placeholder', () => {
  afterEach(() => {
    mockCookieGet.mockReset();
    mockRedirect.mockClear();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    jest.restoreAllMocks();
  });

  it('redirects unauthenticated visitors to /login', async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(
      TenantAdminPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('renders 403 access-denied view linking back to /pk-alpha/counter for COUNTER_STAFF', async () => {
    stubSessionCookie({
      userId: 'cs-1',
      email: 'counter@pk-alpha.vn',
      fullName: 'Lê Minh',
      primaryRole: 'COUNTER_STAFF',
      roles: ['COUNTER_STAFF'],
      tenantCode: 'pk-alpha',
    });

    const ui = await TenantAdminPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) });
    render(ui);

    expect(screen.getByRole('alert')).toHaveTextContent('403');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Không có quyền truy cập' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
      'href',
      '/pk-alpha/counter'
    );
  });

  it('renders 403 access-denied view when TENANT_ADMIN visits another tenantSlug', async () => {
    stubSessionCookie({
      userId: 'ta-1',
      email: 'admin@pk-alpha.vn',
      fullName: 'Nguyễn Văn An',
      primaryRole: 'TENANT_ADMIN',
      roles: ['TENANT_ADMIN'],
      tenantCode: 'pk-alpha',
    });

    const ui = await TenantAdminPage({ params: Promise.resolve({ tenantSlug: 'pk-beta' }) });
    render(ui);

    expect(screen.getByRole('alert')).toHaveTextContent('403');
    expect(screen.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
      'href',
      '/pk-alpha/tenant'
    );
  });

  it('renders 403 access-denied view linking to /admin when SUPERADMIN visits a tenant route', async () => {
    stubSessionCookie({
      userId: 'sa-1',
      email: 'super@nextturn.vn',
      fullName: 'Quản trị nền tảng',
      primaryRole: 'SUPERADMIN',
      roles: ['SUPERADMIN'],
      tenantCode: null,
    });

    const ui = await TenantAdminPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) });
    render(ui);

    expect(screen.getByRole('alert')).toHaveTextContent('403');
    expect(screen.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
      'href',
      '/admin'
    );
  });

  it('renders operational placeholder for authorized TENANT_ADMIN and signs out via POST /api/auth/logout', async () => {
    const user = userEvent.setup();
    stubSessionCookie({
      userId: 'ta-1',
      email: 'admin@pk-alpha.vn',
      fullName: 'Nguyễn Văn An',
      primaryRole: 'TENANT_ADMIN',
      roles: ['TENANT_ADMIN'],
      tenantCode: 'pk-alpha',
    });

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { redirectPath: '/login' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const ui = await TenantAdminPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) });
    render(ui);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên cơ sở')).toBeInTheDocument();
    expect(screen.getByText('pk-alpha')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('admin@pk-alpha.vn')).toBeInTheDocument();

    const logoutButton = screen.getByRole('button', { name: 'Đăng xuất' });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
