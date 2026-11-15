import { expect, test } from '@playwright/test';

import { type E2eServerHandle, startE2eServers } from './support/e2e-harness';

let servers: E2eServerHandle;

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

    const inputBox = await tenantInput.boundingBox();
    const buttonBox = await submitButton.boundingBox();
    expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(inputBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.width ?? 0).toBeGreaterThanOrEqual(44);

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

    servers.state.superAdminOutage = true;
    await page.goto(`${servers.baseUrl}/admin`);

    await expect(page.locator('main [role="alert"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    await expect(page.getByText(/Đổi mã cơ sở/i)).toHaveCount(0);
    await expect(page.getByLabel(/Mã cơ sở/i)).toHaveCount(0);

    const hasOverflowOnAdminFallback = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflowOnAdminFallback).toBe(false);

    servers.state.superAdminOutage = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
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

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
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
    await expect(page.getByRole('link', { name: 'Quay lại cổng của bạn' })).toHaveAttribute(
      'href',
      '/pk-alpha/counter'
    );

    await page.goto(`${servers.baseUrl}/auth/callback?code=code-superadmin`);
    await page.waitForURL(`**/admin`);
    await expect(page.getByText('Quản trị viên nền tảng', { exact: true })).toBeVisible();
    await expect(page.getByText(/Đổi mã cơ sở/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL(`**/login`);

    await page.goto(`${servers.baseUrl}/auth/callback?code=code-end-user`);
    await expect(page.locator('main [role="alert"]')).toContainText(
      'Tài khoản không có quyền truy cập'
    );
    await expect(page.getByRole('link', { name: 'Quay lại chọn cơ sở' })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});
