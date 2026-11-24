import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  authUserSummarySchema,
  backendAuthTokenDataSchema,
  computePortalDestination,
} from '@/features/auth/auth-session.schema';
import { clearSessionCookies, setSessionCookies } from '@/lib/auth/session-cookies';
import { buildBffErrorResponse, buildMappedAuthErrorResponse } from '@/lib/bff/envelope';
import { getServerEnv } from '@/lib/env';

const backendTokenSuccessSchema = z.object({
  success: z.literal(true),
  data: backendAuthTokenDataSchema,
});

export interface ProxyAuthTokenOptions {
  endpointPath: '/api/v1/auth/token' | '/api/v1/auth/refresh';
  requestBody: Record<string, string>;
  clearCookiesPolicy: 'always' | 'auth-rejected';
}

function maybeClearCookies(
  response: NextResponse,
  policy: ProxyAuthTokenOptions['clearCookiesPolicy'],
  status: number
): NextResponse {
  if (policy === 'always' || status === 401 || status === 403) {
    clearSessionCookies(response);
  }

  return response;
}

/**
 * Proxies OIDC token exchange or refresh requests and stores resulting tokens in httpOnly cookies.
 */
export async function proxyAuthTokenExchange({
  endpointPath,
  requestBody,
  clearCookiesPolicy,
}: ProxyAuthTokenOptions): Promise<NextResponse> {
  let backendUrl: string;
  try {
    backendUrl = getServerEnv().backendUrl;
  } catch {
    return buildBffErrorResponse(
      503,
      'SYS_001',
      'Hệ thống xác thực chưa sẵn sàng. Vui lòng thử lại sau.'
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}${endpointPath}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return maybeClearCookies(
      buildBffErrorResponse(
        503,
        'SYS_001',
        'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.'
      ),
      clearCookiesPolicy,
      503
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    const status = upstream.status === 503 ? 503 : 502;
    return maybeClearCookies(
      buildBffErrorResponse(
        status,
        status === 503 ? 'AUTH_011' : 'SYS_001',
        'Phản hồi xác thực không hợp lệ. Vui lòng thử lại.'
      ),
      clearCookiesPolicy,
      status
    );
  }

  if (!upstream.ok) {
    const errorResponse = buildMappedAuthErrorResponse(upstream.status, payload);
    return maybeClearCookies(errorResponse, clearCookiesPolicy, errorResponse.status);
  }

  const verifiedToken = backendTokenSuccessSchema.safeParse(payload);
  if (!verifiedToken.success) {
    const errorResponse = buildBffErrorResponse(
      502,
      'AUTH_012',
      'Dữ liệu phiên đăng nhập không hợp lệ.'
    );
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  const tokenData = verifiedToken.data.data;
  const redirectPath = computePortalDestination(tokenData.primaryRole, tokenData.tenantCode);
  const parsedSummary = authUserSummarySchema.safeParse({
    userId: tokenData.userId,
    email: tokenData.email,
    fullName: tokenData.fullName,
    primaryRole: tokenData.primaryRole,
    roles: tokenData.roles,
    tenantCode: tokenData.tenantCode?.trim() ?? null,
  });

  if (!redirectPath || !parsedSummary.success) {
    const errorResponse = buildBffErrorResponse(
      502,
      'AUTH_012',
      'Thiếu thông tin cơ sở hoặc vai trò hợp lệ cho phiên đăng nhập.'
    );
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  const response = NextResponse.json(
    {
      success: true,
      data: {
        user: parsedSummary.data,
        redirectPath,
      },
    },
    { status: 200 }
  );

  setSessionCookies(response, tokenData, parsedSummary.data);
  return response;
}
