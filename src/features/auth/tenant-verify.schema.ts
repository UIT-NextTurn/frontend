import { z } from 'zod';

export const tenantCodePattern = /^[a-z0-9-]+$/;

export const tenantVerifySchema = z.object({
  tenantCode: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã cơ sở.')
    .min(3, 'Mã cơ sở phải có từ 3 đến 30 ký tự.')
    .max(30, 'Mã cơ sở tối đa 30 ký tự.')
    .regex(tenantCodePattern, 'Mã cơ sở chỉ gồm chữ thường không dấu, số và dấu gạch ngang (-).'),
});

export type TenantVerifyInput = z.infer<typeof tenantVerifySchema>;

/**
 * Validates that an external redirect target uses http: or https: only.
 */
export function isSafeHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const tenantVerifyResponseDataSchema = z.object({
  tenantId: z.string(),
  tenantCode: z.string(),
  tenantName: z.string(),
  status: z.literal('ACTIVE'),
  organisationId: z.string().nullable().optional(),
  loginUrl: z.string().refine(isSafeHttpUrl, {
    message: 'Đường dẫn đăng nhập không hợp lệ.',
  }),
  allowedRoles: z.array(z.string()),
});

export type TenantVerifyResponseData = z.infer<typeof tenantVerifyResponseDataSchema>;
