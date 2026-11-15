import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  tenantVerifyResponseDataSchema,
  tenantVerifySchema,
} from '@/features/auth/tenant-verify.schema';
import { getServerEnv } from '@/lib/env';

const backendVerifySuccessSchema = z.object({
  success: z.literal(true),
  data: tenantVerifyResponseDataSchema,
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_002',
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        data: { tenantCode: 'Vui lòng nhập mã cơ sở.' },
      },
      { status: 400 }
    );
  }

  const parsedInput = tenantVerifySchema.safeParse(rawBody);
  if (!parsedInput.success) {
    const fieldError = parsedInput.error.issues[0]?.message ?? 'Mã cơ sở không đúng định dạng.';
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_002',
        message: fieldError,
        data: { tenantCode: fieldError },
      },
      { status: 400 }
    );
  }

  const { backendUrl } = getServerEnv();
  const upstream = await fetch(`${backendUrl}/api/v1/auth/tenant/verify`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ tenantCode: parsedInput.data.tenantCode }),
  });

  const payload: unknown = await upstream.json();
  const verified = backendVerifySuccessSchema.safeParse(payload);
  if (!verified.success) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'AUTH_012',
        message: 'Không thể khởi tạo đường dẫn đăng nhập hợp lệ cho cơ sở.',
      },
      { status: 502 }
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
