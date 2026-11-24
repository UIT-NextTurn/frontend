import { render, screen } from '@testing-library/react';

import CounterStaffPage from './page';

const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockCookieGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookieGet,
  })),
}));

jest.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
  useRouter: () => ({
    replace: jest.fn(),
    refresh: jest.fn(),
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

describe('/[tenantSlug]/counter guard and placeholder', () => {
  afterEach(() => {
    mockCookieGet.mockReset();
    mockRedirect.mockClear();
  });

  it('redirects unauthenticated visitors to /login', async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(
      CounterStaffPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/login');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('renders 403 access-denied view linking back to /pk-alpha/tenant for TENANT_ADMIN', async () => {
    stubSessionCookie({
      userId: 'ta-1',
      email: 'admin@pk-alpha.vn',
      fullName: 'Nguyễn Văn An',
      primaryRole: 'TENANT_ADMIN',
      roles: ['TENANT_ADMIN'],
      tenantCode: 'pk-alpha',
    });

    const ui = await CounterStaffPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) });
    render(ui);

    expect(screen.getByRole('alert')).toHaveTextContent('403');
    expect(screen.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
      'href',
      '/pk-alpha/tenant'
    );
  });

  it('renders operational placeholder with Nhân viên quầy, Mã cơ sở, and Đăng xuất button', async () => {
    stubSessionCookie({
      userId: 'cs-1',
      email: 'counter@pk-alpha.vn',
      fullName: 'Lê Minh',
      primaryRole: 'COUNTER_STAFF',
      roles: ['COUNTER_STAFF'],
      tenantCode: 'pk-alpha',
    });

    const ui = await CounterStaffPage({ params: Promise.resolve({ tenantSlug: 'pk-alpha' }) });
    render(ui);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên quầy')).toBeInTheDocument();
    expect(screen.getByText('pk-alpha')).toBeInTheDocument();
    expect(screen.getByText('Lê Minh')).toBeInTheDocument();
    expect(screen.getByText('counter@pk-alpha.vn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });
});
