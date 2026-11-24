import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerEnv } from '@/lib/env';

const healthPayloadSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.string(),
    system: z.string(),
    version: z.string(),
  }),
});

export async function GET() {
  let backendUrl: string;
  try {
    backendUrl = getServerEnv().backendUrl;
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_001',
        message: 'Hệ thống kiểm tra kết nối máy chủ chưa được cấu hình hợp lệ.',
      },
      { status: 503 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/v1/health`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_001',
        message: 'Không thể kết nối đến máy chủ dịch vụ.',
      },
      { status: 503 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_001',
        message: 'Máy chủ dịch vụ phản hồi trạng thái không hợp lệ.',
      },
      { status: 502 }
    );
  }

  try {
    const raw: unknown = await upstream.json();
    const parsed = healthPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'SYS_001',
          message: 'Dữ liệu trạng thái máy chủ không hợp lệ.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: parsed.data.data,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        errorCode: 'SYS_001',
        message: 'Dữ liệu trạng thái máy chủ không hợp lệ.',
      },
      { status: 502 }
    );
  }
}
