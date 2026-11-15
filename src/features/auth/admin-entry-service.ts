import 'server-only';

import { z } from 'zod';

import { isSafeHttpUrl } from '@/features/auth/tenant-verify.schema';
import { getServerEnv } from '@/lib/env';

const platformAdminLoginUrlSchema = z.object({
  success: z.literal(true),
  data: z.object({
    loginUrl: z.string().refine(isSafeHttpUrl, {
      message: 'Đường dẫn đăng nhập Keycloak không hợp lệ.',
    }),
  }),
});

export type PlatformAdminLoginUrlResult =
  { ok: true; loginUrl: string } | { ok: false; message: string };

/**
 * Fetches Keycloak Platform Administrator OIDC redirect URL server-side without X-Tenant-Code.
 */
export async function fetchPlatformAdminLoginUrl(): Promise<PlatformAdminLoginUrlResult> {
  let backendUrl: string;
  try {
    backendUrl = getServerEnv().backendUrl;
  } catch {
    return {
      ok: false,
      message: 'Hệ thống xác thực chưa được cấu hình đầy đủ. Vui lòng thử lại sau.',
    };
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/v1/auth/superadmin/login-url`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    return {
      ok: false,
      message: 'Không thể kết nối đến hệ thống xác thực Keycloak. Vui lòng thử lại.',
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      message: 'Dịch vụ đăng nhập Quản trị viên nền tảng hiện tạm thời gián đoạn.',
    };
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return {
      ok: false,
      message: 'Phản hồi cấu hình đăng nhập không hợp lệ. Vui lòng thử lại.',
    };
  }

  const parsed = platformAdminLoginUrlSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Không nhận được đường dẫn đăng nhập Keycloak hợp lệ.',
    };
  }

  return {
    ok: true,
    loginUrl: parsed.data.data.loginUrl,
  };
}
