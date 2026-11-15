import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  extractInactiveTenantStatus,
  tenantVerifyResponseDataSchema,
  tenantVerifySchema,
} from '@/features/auth/tenant-verify.schema';
import { getServerEnv } from '@/lib/env';

const backendVerifySuccessSchema = z.object({
  success: z.literal(true),
  data: tenantVerifyResponseDataSchema,
});

const backendErrorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.string()).nullable().optional(),
});

function buildErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      errorCode,
      message,
      ...extra,
    },
    { status }
  );
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return buildErrorResponse(400, 'SYS_002', 'Dữ liệu yêu cầu không hợp lệ.', {
      data: { tenantCode: 'Vui lòng nhập mã cơ sở.' },
    });
  }

  const parsedInput = tenantVerifySchema.safeParse(rawBody);
  if (!parsedInput.success) {
    const fieldError = parsedInput.error.issues[0]?.message ?? 'Mã cơ sở không đúng định dạng.';
    return buildErrorResponse(400, 'SYS_002', fieldError, {
      data: { tenantCode: fieldError },
    });
  }

  let backendUrl: string;
  try {
    backendUrl = getServerEnv().backendUrl;
  } catch {
    return buildErrorResponse(
      503,
      'SYS_001',
      'Hệ thống xác thực chưa sẵn sàng. Vui lòng thử lại sau.'
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/v1/auth/tenant/verify`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ tenantCode: parsedInput.data.tenantCode }),
    });
  } catch {
    return buildErrorResponse(
      503,
      'SYS_001',
      'Không thể kết nối đến hệ thống xác thực. Vui lòng thử lại.'
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return buildErrorResponse(
      upstream.status === 503 ? 503 : 502,
      upstream.status === 503 ? 'AUTH_011' : 'SYS_001',
      'Hệ thống xác thực hiện tạm thời gián đoạn. Vui lòng thử lại.'
    );
  }

  const errorEnvelope = backendErrorEnvelopeSchema.safeParse(payload);
  const errorCode = errorEnvelope.success ? errorEnvelope.data.errorCode : undefined;

  if (upstream.status === 403 && errorCode === 'AUTH_004') {
    const tenantStatus = extractInactiveTenantStatus(errorEnvelope.data?.message);
    return buildErrorResponse(
      403,
      'AUTH_004',
      'Cơ sở hiện chưa sẵn sàng hoạt động.',
      tenantStatus ? { tenantStatus } : undefined
    );
  }

  if (upstream.status === 404 || errorCode === 'AUTH_003') {
    return buildErrorResponse(404, 'AUTH_003', 'Không tìm thấy cơ sở với mã đã nhập.');
  }

  if (upstream.status === 400 && errorCode === 'SYS_002') {
    const fieldMap = errorEnvelope.success ? errorEnvelope.data.data : undefined;
    return buildErrorResponse(400, 'SYS_002', 'Mã cơ sở không hợp lệ.', {
      data: {
        tenantCode: fieldMap?.tenantCode ?? 'Mã cơ sở không đúng định dạng.',
      },
    });
  }

  if (upstream.status === 400 && errorCode === 'AUTH_009') {
    return buildErrorResponse(400, 'AUTH_009', 'Thông tin mã cơ sở gửi lên không nhất quán.');
  }

  if (upstream.status === 503 || errorCode === 'AUTH_011') {
    return buildErrorResponse(
      503,
      'AUTH_011',
      'Dịch vụ đăng nhập Keycloak hiện tạm thời gián đoạn. Vui lòng thử lại.'
    );
  }

  if (!upstream.ok) {
    return buildErrorResponse(
      502,
      errorCode === 'AUTH_012' ? 'AUTH_012' : 'SYS_001',
      'Không thể khởi tạo phiên đăng nhập. Vui lòng thử lại.'
    );
  }

  const verified = backendVerifySuccessSchema.safeParse(payload);
  if (!verified.success) {
    return buildErrorResponse(
      502,
      'AUTH_012',
      'Không thể khởi tạo đường dẫn đăng nhập hợp lệ cho cơ sở.'
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: verified.data.data,
    },
    { status: 200 }
  );
}
