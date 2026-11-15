import { tokenExchangeRequestSchema } from '@/features/auth/auth-session.schema';
import { proxyAuthTokenExchange } from '@/lib/bff/auth-token-proxy';
import { buildBffErrorResponse } from '@/lib/bff/envelope';

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

  return proxyAuthTokenExchange({
    endpointPath: '/api/v1/auth/token',
    requestBody: {
      code: parsedInput.data.code,
      ...(parsedInput.data.redirectUri ? { redirectUri: parsedInput.data.redirectUri } : {}),
    },
    clearCookiesPolicy: 'always',
  });
}
