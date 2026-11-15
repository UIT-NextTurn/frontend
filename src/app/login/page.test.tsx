import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TenantSelectionForm } from '@/features/auth/tenant-selection-form';

import LoginPage from './page';

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
}));

describe('/login Tenant Selection', () => {
  afterEach(() => {
    mockCookieGet.mockReset();
    mockRedirect.mockClear();
    jest.restoreAllMocks();
  });

  it('renders semantic landmarks, Vietnamese copy, and 48px touch-target controls when session cookies are absent', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const ui = await LoginPage();
    render(ui);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Đăng nhập nhân sự' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Nhập mã cơ sở để chuyển đến cổng đăng nhập dành cho Quản trị viên cơ sở và Nhân viên quầy.'
      )
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Mã cơ sở');
    expect(input).toHaveAttribute('placeholder', 'pk-alpha');
    expect(input.className).toContain('min-h-[48px]');

    expect(
      screen.getByText('Từ 3–30 ký tự gồm chữ thường không dấu, số và dấu gạch ngang (-).')
    ).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Tiếp tục' });
    expect(button.className).toContain('min-h-[48px]');

    expect(
      screen.getByText('Quên mã cơ sở? Liên hệ Quản trị viên cơ sở hoặc bộ phận hỗ trợ nền tảng.')
    ).toBeInTheDocument();
  });

  it('blocks invalid tenantCode inline before calling BFF fetch', async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<TenantSelectionForm />);

    const input = screen.getByLabelText('Mã cơ sở');
    const button = screen.getByRole('button', { name: 'Tiếp tục' });

    await user.type(input, 'PK_Alpha');
    await user.click(button);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('disables submit while verifying and redirects to validated Keycloak loginUrl on ACTIVE', async () => {
    const user = userEvent.setup();
    const onRedirect = jest.fn();

    let resolveResponse: ((value: Response) => void) | undefined;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockReturnValueOnce(pendingFetch);

    render(<TenantSelectionForm onRedirect={onRedirect} />);

    const input = screen.getByLabelText('Mã cơ sở');
    await user.type(input, '  pk-alpha  ');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đang xác minh/i })).toBeDisabled();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/tenant/verify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tenantCode: 'pk-alpha' }),
      })
    );

    resolveResponse?.(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            tenantId: 't-1',
            tenantCode: 'pk-alpha',
            tenantName: 'Phòng khám Alpha',
            status: 'ACTIVE',
            organisationId: 'org-1',
            loginUrl: 'https://sso.nextturn.local/auth/pk-alpha',
            allowedRoles: ['TENANT_ADMIN', 'COUNTER_STAFF'],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('https://sso.nextturn.local/auth/pk-alpha');
    });
  });

  it.each([
    {
      tenantStatus: 'PENDING_APPROVAL',
      codeInput: 'pk-pending',
      expectedTitle: 'Cơ sở đang chờ phê duyệt',
      expectedSnippet: 'Quản trị viên nền tảng',
    },
    {
      tenantStatus: 'SUSPENDED',
      codeInput: 'pk-suspended',
      expectedTitle: 'Cơ sở đang tạm ngưng',
      expectedSnippet: 'tạm ngưng hoạt động',
    },
    {
      tenantStatus: 'REJECTED',
      codeInput: 'pk-rejected',
      expectedTitle: 'Đăng ký cơ sở không được phê duyệt',
      expectedSnippet: 'bị từ chối',
    },
    {
      tenantStatus: undefined,
      codeInput: 'pk-inactive',
      expectedTitle: 'Cơ sở chưa sẵn sàng đăng nhập',
      expectedSnippet: 'chưa ở trạng thái hoạt động',
    },
  ])(
    'renders distinct Vietnamese recovery alert for AUTH_004 ($tenantStatus) and preserves input',
    async ({ tenantStatus, codeInput, expectedTitle, expectedSnippet }) => {
      const user = userEvent.setup();
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            errorCode: 'AUTH_004',
            message: 'Cơ sở hiện chưa sẵn sàng hoạt động.',
            ...(tenantStatus ? { tenantStatus } : {}),
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      render(<TenantSelectionForm />);

      const input = screen.getByLabelText('Mã cơ sở');
      await user.type(input, codeInput);
      await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedTitle);
      expect(alert).toHaveTextContent(expectedSnippet);
      expect(alert.querySelector('svg')).not.toBeNull();
      expect(input).toHaveValue(codeInput);
      expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
    }
  );

  it('displays unknown-tenant guidance on 404 AUTH_003 and preserves input', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'AUTH_003',
          message: 'Không tìm thấy cơ sở với mã đã nhập.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(<TenantSelectionForm />);

    const input = screen.getByLabelText('Mã cơ sở');
    await user.type(input, 'pk-missing');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tìm thấy cơ sở');
    expect(input).toHaveValue('pk-missing');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
  });

  it('maps 400 SYS_002 field error directly onto the tenantCode input', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'SYS_002',
          message: 'Mã cơ sở không hợp lệ.',
          data: { tenantCode: 'Mã cơ sở không được máy chủ chấp nhận.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    );

    render(<TenantSelectionForm />);

    const input = screen.getByLabelText('Mã cơ sở');
    await user.type(input, 'pk-alpha');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    const fieldError = await screen.findByRole('alert');
    expect(fieldError).toHaveTextContent('Mã cơ sở không được máy chủ chấp nhận.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders retryable alert on 5xx/network failure and recovers when clicking Thử lại', async () => {
    const user = userEvent.setup();
    const onRedirect = jest.fn();

    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              tenantId: 't-1',
              tenantCode: 'pk-alpha',
              tenantName: 'Phòng khám Alpha',
              status: 'ACTIVE',
              organisationId: 'org-1',
              loginUrl: 'https://sso.nextturn.local/auth/pk-alpha',
              allowedRoles: ['TENANT_ADMIN'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    render(<TenantSelectionForm onRedirect={onRedirect} />);

    await user.type(screen.getByLabelText('Mã cơ sở'), 'pk-alpha');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Không thể kết nối|thử lại/i);

    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryButton.className).toContain('min-h-[44px]');
    await user.click(retryButton);

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('https://sso.nextturn.local/auth/pk-alpha');
    });
  });

  it.each([
    {
      primaryRole: 'SUPERADMIN',
      tenantCode: null,
      expectedPath: '/admin',
    },
    {
      primaryRole: 'TENANT_ADMIN',
      tenantCode: 'pk-alpha',
      expectedPath: '/pk-alpha/tenant',
    },
    {
      primaryRole: 'COUNTER_STAFF',
      tenantCode: 'pk-alpha',
      expectedPath: '/pk-alpha/counter',
    },
  ])(
    'redirects authenticated $primaryRole visitor directly to $expectedPath',
    async ({ primaryRole, tenantCode, expectedPath }) => {
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'nt_access_token') {
          return { name, value: 'active-jwt' };
        }
        if (name === 'nt_session_meta') {
          return {
            name,
            value: JSON.stringify({
              userId: 'u-1',
              email: 'staff@nextturn.vn',
              fullName: 'Nhân sự NextTurn',
              primaryRole,
              roles: [primaryRole],
              tenantCode,
            }),
          };
        }
        return undefined;
      });

      await expect(LoginPage()).rejects.toThrow(`NEXT_REDIRECT:${expectedPath}`);
      expect(mockRedirect).toHaveBeenCalledWith(expectedPath);
    }
  );
});
