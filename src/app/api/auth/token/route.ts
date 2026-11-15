import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  authUserSummarySchema,
  backendAuthTokenDataSchema,
  computePortalDestination,
  tokenExchangeRequestSchema,
} from '@/features/auth/auth-session.schema';
import { clearSessionCookies, setSessionCookies } from '@/lib/auth/session-cookies';
import { buildBffErrorResponse, buildMappedAuthErrorResponse } from '@/lib/bff/envelope';
import { getServerEnv } from '@/lib/env';

const backendTokenSuccessSchema = z.object({
  success: z.literal(true),
  data: backendAuthTokenDataSchema,
});

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
    upstream = await fetch(`${backendUrl}/api/v1/auth/token`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code: parsedInput.data.code,
        ...(parsedInput.data.redirectUri ? { redirectUri: parsedInput.data.redirectUri } : {}),
      }),
    });
  } catch {
    const errorResponse = buildBffErrorResponse(
      503,
      'SYS_001',
      'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.'
    );
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    const errorResponse = buildBffErrorResponse(
      upstream.status === 503 ? 503 : 502,
      upstream.status === 503 ? 'AUTH_011' : 'SYS_001',
      'Phản hồi xác thực không hợp lệ. Vui lòng thử lại.'
    );
    clearSessionCookies(errorResponse);
    return errorResponse;
  }

  if (!upstream.ok) {
    const errorResponse = buildMappedAuthErrorResponse(upstream.status, payload);
    clearSessionCookies(errorResponse);
    return errorResponse;
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
    tenantCode: tokenData.tenantCode ?? null,
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
