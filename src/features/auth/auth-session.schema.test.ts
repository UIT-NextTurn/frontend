import {
  authUserSummarySchema,
  backendAuthTokenDataSchema,
  computePortalDestination,
} from './auth-session.schema';

describe('computePortalDestination', () => {
  it('routes SUPERADMIN to /admin regardless of tenantCode', () => {
    expect(computePortalDestination('SUPERADMIN', null)).toBe('/admin');
    expect(computePortalDestination('SUPERADMIN', undefined)).toBe('/admin');
  });

  it('routes TENANT_ADMIN and COUNTER_STAFF using normalized tenantCode slug', () => {
    expect(computePortalDestination('TENANT_ADMIN', 'pk-alpha')).toBe('/pk-alpha/tenant');
    expect(computePortalDestination('TENANT_ADMIN', '  pk-alpha  ')).toBe('/pk-alpha/tenant');
    expect(computePortalDestination('COUNTER_STAFF', 'pk-beta-01')).toBe('/pk-beta-01/counter');
  });

  it('returns null when TENANT_ADMIN or COUNTER_STAFF lacks a valid tenantCode slug', () => {
    expect(computePortalDestination('TENANT_ADMIN', null)).toBeNull();
    expect(computePortalDestination('TENANT_ADMIN', '')).toBeNull();
    expect(computePortalDestination('COUNTER_STAFF', undefined)).toBeNull();
    expect(computePortalDestination('COUNTER_STAFF', '../admin')).toBeNull();
    expect(computePortalDestination('TENANT_ADMIN', 'PK_ALPHA')).toBeNull();
  });

  it('returns null for unrecognized or non-staff roles', () => {
    expect(computePortalDestination('END_USER', 'pk-alpha')).toBeNull();
    expect(computePortalDestination('SPECIALIST', 'pk-alpha')).toBeNull();
  });

  it('allows backendAuthTokenDataSchema to parse non-staff roles while authUserSummarySchema rejects them', () => {
    const basePayload = {
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
      userId: 'u-1',
      email: 'customer@nextturn.vn',
      fullName: 'Khách hàng',
      roles: ['END_USER'],
      primaryRole: 'END_USER',
      tenantCode: 'pk-alpha',
    };

    expect(backendAuthTokenDataSchema.safeParse(basePayload).success).toBe(true);
    expect(authUserSummarySchema.safeParse(basePayload).success).toBe(false);
  });
});
