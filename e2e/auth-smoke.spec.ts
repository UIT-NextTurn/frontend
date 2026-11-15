import { expect, type Locator, test } from '@playwright/test';

import { type E2eServerHandle, startE2eServers } from './support/e2e-harness';

let servers: E2eServerHandle;

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
}

test.beforeAll(async () => {
  servers = await startE2eServers();
});

test.afterAll(async () => {
  await servers?.stop();
});

test.beforeEach(async ({ context }) => {
  servers.resetState();
  await context.clearCookies();
});

test.describe('Authentication & Entry Flows E2E', () => {
  test('/login validates client format, handles AUTH_003 / AUTH_004 / SYS_002 recovery, and checks mobile dimensions', async ({
    page,
  }) => {
    await page.goto(`${servers.baseUrl}/login`);

    const tenantInput = page.getByLabel('Mã cơ sở');
    const submitButton = page.getByRole('button', { name: 'Tiếp tục' });

    await expectTouchTarget(tenantInput);
    await expectTouchTarget(submitButton);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    await tenantInput.fill('PK_Alpha');
    await submitButton.click();
    await expect(page.locator('main [role="alert"]')).toContainText('chỉ gồm chữ thường');

    for (const scenario of [
      { code: 'pk-pending', expected: 'Cơ sở đang chờ phê duyệt' },
      { code: 'pk-suspended', expected: 'Cơ sở đang tạm ngưng' },
      { code: 'pk-rejected', expected: 'Đăng ký cơ sở không được phê duyệt' },
      { code: 'pk-unknown', expected: 'Không tìm thấy cơ sở' },
      { code: 'pk-sys002', expected: 'Mã cơ sở không hợp lệ theo quy định máy chủ' },
    ]) {
      await tenantInput.fill(scenario.code);
      await submitButton.click();
      await expect(page.locator('main [role="alert"]').first()).toContainText(scenario.expected);
      await expect(tenantInput).toHaveValue(scenario.code);
    }

    await tenantInput.fill('pk-alpha');
    await submitButton.click();
    await page.waitForURL(`**/mock-keycloak/tenant?tenantCode=pk-alpha`);
    await expect(page.getByTestId('mock-keycloak')).toContainText('/mock-keycloak/tenant');
  });

  test('/admin redirects directly when healthy and shows dark fallback without Đổi mã cơ sở on outage', async ({
    page,
  }) => {
    await page.goto(`${servers.baseUrl}/admin`);
    await page.waitForURL(`**/mock-keycloak/superadmin`);
    await expect(page.getByTestId('mock-keycloak')).toContainText('/mock-keycloak/superadmin');

    servers.state.platformAdminOutage = true;
    await page.goto(`${servers.baseUrl}/admin`);

    const retryButton = page.getByRole('button', { name: 'Thử lại' });
    await expect(page.locator('main [role="alert"]')).toBeVisible();
    await expect(retryButton).toBeVisible();
    await expectTouchTarget(retryButton);
    await expect(page.getByText(/Đổi mã cơ sở/i)).toHaveCount(0);
    await expect(page.getByLabel(/Mã cơ sở/i)).toHaveCount(0);

    const hasOverflowOnAdminFallback = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflowOnAdminFallback).toBe(false);

    servers.state.platformAdminOutage = false;
    await retryButton.click();
    await page.waitForURL(`**/mock-keycloak/superadmin`);
  });

  test('/auth/callback exchanges code via httpOnly cookies, routes TENANT_ADMIN, enforces /login guard, and signs out', async ({
    page,
    context,
  }) => {
    await page.goto(`${servers.baseUrl}/auth/callback?code=code-tenant-admin`);
    await page.waitForURL(`**/pk-alpha/tenant`);

    await expect(page.getByText('Quản trị viên cơ sở', { exact: true })).toBeVisible();
    await expect(page.getByText('pk-alpha', { exact: true })).toBeVisible();
    await expect(page.getByText('Nguyễn Văn An', { exact: true })).toBeVisible();
    expect(servers.state.tokenExchangeCalls).toBe(1);

    const storageAndClientCookies = await page.evaluate(() => ({
      documentCookie: document.cookie,
      localLen: window.localStorage.length,
      sessionLen: window.sessionStorage.length,
    }));
    expect(storageAndClientCookies.documentCookie).not.toContain('jwt-ta-access');
    expect(storageAndClientCookies.documentCookie).not.toContain('nt_access_token');
    expect(storageAndClientCookies.localLen).toBe(0);
    expect(storageAndClientCookies.sessionLen).toBe(0);

    const browserCookies = await context.cookies();
    const accessCookie = browserCookies.find((cookie) => cookie.name === 'nt_access_token');
    const refreshCookie = browserCookies.find((cookie) => cookie.name === 'nt_refresh_token');
    expect(accessCookie?.httpOnly).toBe(true);
    expect(accessCookie?.sameSite).toBe('Lax');
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.sameSite).toBe('Lax');

    const hasPortalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasPortalOverflow).toBe(false);

    await page.goto(`${servers.baseUrl}/login`);
    await page.waitForURL(`**/pk-alpha/tenant`);

    const logoutButton = page.getByRole('button', { name: 'Đăng xuất' });
    await expectTouchTarget(logoutButton);
    await logoutButton.click();
    await page.waitForURL(`**/login`);
    await expect(page.getByLabel('Mã cơ sở')).toBeVisible();
    expect(servers.state.logoutCalls).toBe(1);
  });

  test('/auth/callback routes COUNTER_STAFF & SUPERADMIN, isolates wrong-role portals, and blocks END_USER', async ({
    page,
  }) => {
    await page.goto(`${servers.baseUrl}/auth/callback?code=code-counter-staff`);
    await page.waitForURL(`**/pk-alpha/counter`);
    await expect(page.getByText('Nhân viên quầy', { exact: true })).toBeVisible();

    await page.goto(`${servers.baseUrl}/pk-alpha/tenant`);
    await expect(page.locator('main [role="alert"]')).toContainText('403');
    const backToPortalLink = page.getByRole('link', { name: 'Quay lại cổng của bạn' });
    await expect(backToPortalLink).toHaveAttribute('href', '/pk-alpha/counter');
    await expectTouchTarget(backToPortalLink);

    await page.goto(`${servers.baseUrl}/auth/callback?code=code-superadmin`);
    await page.waitForURL(`**/admin`);
    await expect(page.getByText('Quản trị viên nền tảng', { exact: true })).toBeVisible();
    await expect(page.getByText(/Đổi mã cơ sở/i)).toHaveCount(0);

    const adminLogoutButton = page.getByRole('button', { name: 'Đăng xuất' });
    await expectTouchTarget(adminLogoutButton);
    await adminLogoutButton.click();
    await page.waitForURL(`**/login`);

    await page.goto(`${servers.baseUrl}/auth/callback?code=code-end-user`);
    await expect(page.locator('main [role="alert"]')).toContainText(
      'Tài khoản không có quyền truy cập'
    );
    const backToLoginLink = page.getByRole('link', { name: 'Quay lại chọn cơ sở' });
    await expect(backToLoginLink).toHaveAttribute('href', '/login');
    await expectTouchTarget(backToLoginLink);
  });

  test('enforces cross-tenant 403 isolation and links back to authorized portal', async ({
    page,
  }) => {
    await page.goto(`${servers.baseUrl}/auth/callback?code=code-tenant-admin`);
    await page.waitForURL(`**/pk-alpha/tenant`);

    await page.goto(`${servers.baseUrl}/pk-beta/tenant`);
    await expect(page.locator('main [role="alert"]')).toContainText('403');
    await expect(page.locator('main [role="alert"]')).toContainText(
      'Tài khoản này thuộc cơ sở khác'
    );

    const backToPortalLink = page.getByRole('link', { name: 'Quay lại cổng của bạn' });
    await expect(backToPortalLink).toHaveAttribute('href', '/pk-alpha/tenant');
    await expectTouchTarget(backToPortalLink);

    await backToPortalLink.click();
    await page.waitForURL(`**/pk-alpha/tenant`);
  });

  test('/auth/callback shows recovery UI for missing ?code and clears active session on ?error=access_denied', async ({
    page,
    context,
  }) => {
    await page.goto(`${servers.baseUrl}/auth/callback`);
    await expect(page.locator('main [role="alert"]')).toContainText('Thiếu mã xác thực');
    const missingCodeLink = page.getByRole('link', { name: 'Quay lại chọn cơ sở' });
    await expect(missingCodeLink).toHaveAttribute('href', '/login');
    await expectTouchTarget(missingCodeLink);

    await page.goto(`${servers.baseUrl}/auth/callback?code=code-tenant-admin`);
    await page.waitForURL(`**/pk-alpha/tenant`);

    await page.goto(`${servers.baseUrl}/auth/callback?error=access_denied`);
    await expect(page.locator('main [role="alert"]')).toContainText('Bạn đã hủy đăng nhập');
    const deniedLink = page.getByRole('link', { name: 'Quay lại chọn cơ sở' });
    await expect(deniedLink).toHaveAttribute('href', '/login');
    await expectTouchTarget(deniedLink);

    await expect
      .poll(async () => {
        const currentCookies = await context.cookies();
        return currentCookies.some((cookie) => cookie.name === 'nt_access_token');
      })
      .toBe(false);
    expect(servers.state.logoutCalls).toBe(1);

    const cookiesAfterDenied = await context.cookies();
    for (const cookieName of ['nt_refresh_token', 'nt_session_meta']) {
      expect(cookiesAfterDenied.find((cookie) => cookie.name === cookieName)).toBeUndefined();
    }

    await deniedLink.click();
    await page.waitForURL(`**/login`);
    await expect(page.getByLabel('Mã cơ sở')).toBeVisible();
  });

  test('POST /api/auth/refresh rotates httpOnly cookies and clears session cookies on invalid refresh token', async ({
    page,
    context,
  }) => {
    await page.goto(`${servers.baseUrl}/auth/callback?code=code-tenant-admin`);
    await page.waitForURL(`**/pk-alpha/tenant`);

    const refreshSuccess = await page.evaluate(async () => {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      const rawBody: unknown = await response.json();
      const body =
        typeof rawBody === 'object' && rawBody !== null
          ? Object.fromEntries(Object.entries(rawBody))
          : {};
      return {
        status: response.status,
        success: body.success,
        documentCookie: document.cookie,
      };
    });

    expect(refreshSuccess.status).toBe(200);
    expect(refreshSuccess.success).toBe(true);
    expect(servers.state.refreshCalls).toBe(1);
    expect(refreshSuccess.documentCookie).not.toContain('jwt-ta-access-rotated');
    expect(refreshSuccess.documentCookie).not.toContain('jwt-ta-refresh-rotated');
    expect(refreshSuccess.documentCookie).not.toContain('nt_access_token');

    const rotatedCookies = await context.cookies();
    const rotatedAccessCookie = rotatedCookies.find((cookie) => cookie.name === 'nt_access_token');
    const rotatedRefreshCookie = rotatedCookies.find(
      (cookie) => cookie.name === 'nt_refresh_token'
    );
    expect(rotatedAccessCookie?.value).toBe('jwt-ta-access-rotated');
    expect(rotatedAccessCookie?.httpOnly).toBe(true);
    expect(rotatedAccessCookie?.sameSite).toBe('Lax');
    expect(rotatedRefreshCookie?.value).toBe('jwt-ta-refresh-rotated');
    expect(rotatedRefreshCookie?.httpOnly).toBe(true);
    expect(rotatedRefreshCookie?.sameSite).toBe('Lax');

    await context.addCookies([
      {
        name: 'nt_refresh_token',
        value: 'invalid-refresh-token',
        url: servers.baseUrl,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    const refreshFailure = await page.evaluate(async () => {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      const rawBody: unknown = await response.json();
      const body =
        typeof rawBody === 'object' && rawBody !== null
          ? Object.fromEntries(Object.entries(rawBody))
          : {};
      return {
        status: response.status,
        success: body.success,
        errorCode: body.errorCode,
      };
    });

    expect(refreshFailure.status).toBe(401);
    expect(refreshFailure.success).toBe(false);
    expect(refreshFailure.errorCode).toBe('AUTH_008');
    expect(servers.state.refreshCalls).toBe(2);

    const cookiesAfterFailure = await context.cookies();
    for (const cookieName of ['nt_access_token', 'nt_refresh_token', 'nt_session_meta']) {
      expect(cookiesAfterFailure.find((cookie) => cookie.name === cookieName)).toBeUndefined();
    }

    await page.goto(`${servers.baseUrl}/login`);
    await page.waitForURL(`**/login`);
    await expect(page.getByLabel('Mã cơ sở')).toBeVisible();
  });
});
