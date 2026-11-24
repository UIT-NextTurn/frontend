import { tokenExchangeRequestSchema } from '@/features/auth/auth-session.schema';
import { proxyAuthTokenExchange } from '@/lib/bff/auth-token-proxy';
import { buildBffErrorResponse } from '@/lib/bff/envelope';

function resolveExpectedOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (!forwardedHost) {
    return requestUrl.origin;
  }

  const rawProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const protocol =
    rawProto === 'http' || rawProto === 'https' ? rawProto : requestUrl.protocol.replace(/:$/, '');

  try {
    return new URL(`${protocol}://${forwardedHost}`).origin;
  } catch {
    return requestUrl.origin;
  }
}

function isValidCallbackRedirectUri(redirectUri: string, request: Request): boolean {
  try {
    const parsedRedirectUri = new URL(redirectUri);
    const isHttpProtocol =
      parsedRedirectUri.protocol === 'http:' || parsedRedirectUri.protocol === 'https:';
    if (!isHttpProtocol) {
      return false;
    }

    return (
      parsedRedirectUri.pathname === '/auth/callback' &&
      parsedRedirectUri.origin === resolveExpectedOrigin(request)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return buildBffErrorResponse(400, 'SYS_002', 'Dữ liệu yêu cầu không hợp lệ.');
  }

  const parsedInput = tokenExchangeRequestSchema.safeParse(rawBody);
  if (!parsedInput.success) {
    const fieldError = parsedInput.error.issues[0]?.message ?? 'Thiếu mã xác thực.';
    return buildBffErrorResponse(400, 'SYS_002', fieldError);
  }

  if (
    parsedInput.data.redirectUri &&
    !isValidCallbackRedirectUri(parsedInput.data.redirectUri, request)
  ) {
    return buildBffErrorResponse(400, 'SYS_002', 'Đường dẫn chuyển hướng không hợp lệ.');
  }

  return proxyAuthTokenExchange({
    endpointPath: '/api/v1/auth/token',
    requestBody: {
      code: parsedInput.data.code,
      ...(parsedInput.data.redirectUri ? { redirectUri: parsedInput.data.redirectUri } : {}),
    },
    clearCookiesPolicy: 'always',
  });
}
