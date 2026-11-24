import { clearSessionCookies, getServerAuthCookies } from '@/lib/auth/session-cookies';
import { proxyAuthTokenExchange } from '@/lib/bff/auth-token-proxy';
import { buildBffErrorResponse } from '@/lib/bff/envelope';

export async function POST() {
  const { refreshToken } = await getServerAuthCookies();

  if (!refreshToken) {
    const response = buildBffErrorResponse(
      401,
      'AUTH_005',
      'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.'
    );
    clearSessionCookies(response);
    return response;
  }

  return proxyAuthTokenExchange({
    endpointPath: '/api/v1/auth/refresh',
    requestBody: { refreshToken },
    clearCookiesPolicy: 'auth-rejected',
  });
}
