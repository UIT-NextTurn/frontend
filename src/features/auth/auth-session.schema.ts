import { z } from 'zod';

import { isSafeHttpUrl, tenantCodeSchema } from './tenant-verify.schema';

export const staffRoleSchema = z.enum(['SUPERADMIN', 'TENANT_ADMIN', 'COUNTER_STAFF']);

export type StaffRole = z.infer<typeof staffRoleSchema>;

export const authUserSummarySchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
  fullName: z.string().min(1),
  primaryRole: staffRoleSchema,
  roles: z.array(z.string()),
  tenantCode: z.string().nullable().optional(),
});

export type AuthUserSummary = z.infer<typeof authUserSummarySchema>;

export const tokenExchangeRequestSchema = z.object({
  code: z.string().trim().min(1, 'Thiếu mã xác thực.'),
  redirectUri: z
    .string()
    .trim()
    .refine(isSafeHttpUrl, { message: 'Đường dẫn chuyển hướng không hợp lệ.' })
    .optional(),
});

export type TokenExchangeRequest = z.infer<typeof tokenExchangeRequestSchema>;

export const backendAuthTokenDataSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  idToken: z.string().nullable().optional(),
  tokenType: z.string().optional(),
  expiresIn: z.number().optional(),
  refreshExpiresIn: z.number().optional(),
  userId: z.string().min(1),
  email: z.string().min(1),
  fullName: z.string().min(1),
  roles: z.array(z.string()),
  primaryRole: z.string().min(1),
  tenantCode: z.string().nullable().optional(),
  targetDashboardUrl: z.string().nullable().optional(),
});

export type BackendAuthTokenData = z.infer<typeof backendAuthTokenDataSchema>;

/**
 * Computes canonical portal path from role and Tenant slug, ignoring backend targetDashboardUrl.
 */
export function computePortalDestination(
  primaryRole: StaffRole | (string & {}),
  tenantCode?: string | null
): string | null {
  const parsedRole = staffRoleSchema.safeParse(primaryRole);
  if (!parsedRole.success) {
    return null;
  }

  if (parsedRole.data === 'SUPERADMIN') {
    return '/admin';
  }

  const parsedTenantCode = tenantCodeSchema.safeParse(tenantCode);
  if (!parsedTenantCode.success) {
    return null;
  }

  switch (parsedRole.data) {
    case 'TENANT_ADMIN':
      return `/${parsedTenantCode.data}/tenant`;
    case 'COUNTER_STAFF':
      return `/${parsedTenantCode.data}/counter`;
  }
}
