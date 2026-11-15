import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import AuthCallbackPage from './page';

const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('/auth/callback OIDC exchange', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows calm Vietnamese loading state, exchanges code once even under StrictMode, and routes to tenant portal', async () => {
    mockSearchParams = new URLSearchParams('code=oidc-code-123');

    let resolveFetch: ((response: Response) => void) | undefined;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockReturnValueOnce(pendingFetch);

    render(
      <StrictMode>
        <AuthCallbackPage />
      </StrictMode>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Đang hoàn tất đăng nhập' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Đang xác thực phiên làm việc/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'oidc-code-123',
          redirectUri: `${window.location.origin}/auth/callback`,
        }),
      })
    );

    resolveFetch?.(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              userId: 'u-1',
              email: 'admin@pk-alpha.vn',
              fullName: 'Nguyễn Văn An',
              primaryRole: 'TENANT_ADMIN',
              roles: ['TENANT_ADMIN'],
              tenantCode: 'pk-alpha',
            },
            redirectPath: '/pk-alpha/tenant',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/pk-alpha/tenant');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces error alert without redirecting when BFF reports missing tenant context or 502', async () => {
    mockSearchParams = new URLSearchParams('code=broken-code');

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'AUTH_012',
          message: 'Thiếu thông tin cơ sở hoặc vai trò hợp lệ cho phiên đăng nhập.',
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<AuthCallbackPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Thiếu thông tin cơ sở hoặc vai trò hợp lệ cho phiên đăng nhập.'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('handles network rejection and malformed redirect responses safely without redirecting', async () => {
    mockSearchParams = new URLSearchParams('code=code-net');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    render(<AuthCallbackPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('rejects protocol-relative or missing redirectPath in callback response', async () => {
    mockSearchParams = new URLSearchParams('code=code-bad-redirect');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            redirectPath: '//evil.example/steal',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<AuthCallbackPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể xác định cổng làm việc phù hợp cho tài khoản này.'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('skips BFF token call on ?error query param, suppresses raw HTML/script payloads, and links back to /login', () => {
    mockSearchParams = new URLSearchParams(
      'error=access_denied&error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E'
    );
    const fetchSpy = jest.spyOn(global, 'fetch');

    const { container } = render(<AuthCallbackPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Bạn đã hủy đăng nhập');
    expect(alert).not.toHaveTextContent('<script>');
    expect(container.querySelector('script')).toBeNull();

    const backLink = screen.getByRole('link', { name: 'Quay lại chọn cơ sở' });
    expect(backLink).toHaveAttribute('href', '/login');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('skips BFF token call on generic OAuth error query param', () => {
    mockSearchParams = new URLSearchParams('error=temporarily_unavailable');
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<AuthCallbackPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Đăng nhập chưa hoàn tất');
  });

  it('skips BFF token call when ?code is missing and renders recovery link to /login', () => {
    mockSearchParams = new URLSearchParams('');
    const fetchSpy = jest.spyOn(global, 'fetch');

    render(<AuthCallbackPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Thiếu mã xác thực');
    expect(screen.getByRole('link', { name: 'Quay lại chọn cơ sở' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('shows portal-restriction recovery guidance when BFF rejects END_USER with AUTH_010', async () => {
    mockSearchParams = new URLSearchParams('code=end-user-code');
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          errorCode: 'AUTH_010',
          message:
            'Tài khoản khách hàng không có quyền truy cập cổng quản lý nhân sự. Vui lòng sử dụng cổng đặt lịch dành cho khách hàng.',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<AuthCallbackPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Tài khoản không có quyền truy cập');
    expect(alert).toHaveTextContent(/Quản trị viên cơ sở/i);
    expect(screen.getByRole('link', { name: 'Quay lại chọn cơ sở' })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each([
    {
      errorCode: 'AUTH_005',
      status: 401,
      message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      expectedTitle: 'Mã xác thực đã hết hạn',
    },
    {
      errorCode: 'AUTH_011',
      status: 503,
      message: 'Dịch vụ đăng nhập Keycloak hiện tạm thời gián đoạn.',
      expectedTitle: 'Dịch vụ Keycloak tạm gián đoạn',
    },
  ])(
    'surfaces tailored recovery card and /login link for $errorCode',
    async ({ errorCode, status, message, expectedTitle }) => {
      mockSearchParams = new URLSearchParams('code=err-code');
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, errorCode, message }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
      );

      render(<AuthCallbackPage />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedTitle);
      expect(alert).toHaveTextContent(message);
      expect(screen.getByRole('link', { name: 'Quay lại chọn cơ sở' })).toHaveAttribute(
        'href',
        '/login'
      );
    }
  );
});
