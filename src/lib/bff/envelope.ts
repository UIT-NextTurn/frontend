import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractInactiveTenantStatus } from '@/features/auth/tenant-verify.schema';

export const backendErrorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
  data: z.record(z.string(), z.string()).nullable().optional(),
});

const authErrorCatalog: Record<string, { defaultStatus: number; message: string }> = {
  AUTH_003: {
    defaultStatus: 404,
    message: 'Không tìm thấy cơ sở hoặc tổ chức liên kết với tài khoản này.',
  },
  AUTH_004: {
    defaultStatus: 403,
    message: 'Cơ sở hiện chưa sẵn sàng hoạt động.',
  },
  AUTH_005: {
    defaultStatus: 401,
    message: 'Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
  },
  AUTH_007: {
    defaultStatus: 401,
    message: 'Phiên xác thực không hợp lệ. Vui lòng thử đăng nhập lại.',
  },
  AUTH_010: {
    defaultStatus: 403,
    message:
      'Tài khoản khách hàng không có quyền truy cập cổng quản lý nhân sự. Vui lòng sử dụng cổng đặt lịch dành cho khách hàng.',
  },
  AUTH_011: {
    defaultStatus: 503,
    message: 'Dịch vụ đăng nhập Keycloak hiện tạm thời gián đoạn. Vui lòng thử lại.',
  },
};

/**
 * Normalizes backend OIDC exchange or refresh error envelopes into Vietnamese BFF responses.
 */
export function buildMappedAuthErrorResponse(
  upstreamStatus: number,
  payload: unknown
): NextResponse {
  const envelope = backendErrorEnvelopeSchema.safeParse(payload);
  const errorCode = envelope.success ? envelope.data.errorCode : undefined;
  const catalogEntry = errorCode ? authErrorCatalog[errorCode] : undefined;

  if (catalogEntry && errorCode) {
    const tenantStatus =
      errorCode === 'AUTH_004' ? extractInactiveTenantStatus(envelope.data?.message) : undefined;
    return buildBffErrorResponse(
      upstreamStatus >= 400 ? upstreamStatus : catalogEntry.defaultStatus,
      errorCode,
      catalogEntry.message,
      tenantStatus ? { tenantStatus } : undefined
    );
  }

  return buildBffErrorResponse(
    upstreamStatus >= 400 ? upstreamStatus : 502,
    errorCode ?? 'SYS_001',
    'Không thể hoàn tất đăng nhập. Vui lòng thử lại.'
  );
}

/**
 * Creates a standardized JSON error envelope returned by Next.js BFF Route Handlers.
 */
export function buildBffErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  extra?: Record<string, unknown>
): NextResponse {
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
