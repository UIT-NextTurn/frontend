import { type ChildProcess, spawn } from 'node:child_process';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import net from 'node:net';

export interface MockBackendState {
  platformAdminOutage: boolean;
  tokenExchangeCalls: number;
  refreshCalls: number;
  logoutCalls: number;
}

export interface E2eServerHandle {
  baseUrl: string;
  mockUrl: string;
  state: MockBackendState;
  resetState: () => void;
  stop: () => Promise<void>;
}

async function allocateFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to allocate free port.'));
        return;
      }

      const selectedPort = address.port;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(selectedPort);
      });
    });
  });
}

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) {
        resolve({});
        return;
      }

      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          resolve(Object.fromEntries(Object.entries(parsed)));
          return;
        }
        resolve({});
      } catch {
        resolve({});
      }
    });
  });
}

function writeJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function handleTenantVerify(tenantCode: string, mockUrl: string, response: ServerResponse): void {
  switch (tenantCode) {
    case 'pk-alpha':
      writeJson(response, 200, {
        success: true,
        data: {
          tenantId: 't-alpha',
          tenantCode: 'pk-alpha',
          tenantName: 'Phòng khám Alpha',
          status: 'ACTIVE',
          organisationId: 'org-alpha',
          loginUrl: `${mockUrl}/mock-keycloak/tenant?tenantCode=pk-alpha`,
          allowedRoles: ['TENANT_ADMIN', 'COUNTER_STAFF'],
        },
      });
      return;
    case 'pk-pending':
      writeJson(response, 403, {
        success: false,
        errorCode: 'AUTH_004',
        message: 'Tenant inactive. Current status: PENDING_APPROVAL',
      });
      return;
    case 'pk-suspended':
      writeJson(response, 403, {
        success: false,
        errorCode: 'AUTH_004',
        message: 'Tenant inactive. Current status: SUSPENDED',
      });
      return;
    case 'pk-rejected':
      writeJson(response, 403, {
        success: false,
        errorCode: 'AUTH_004',
        message: 'Tenant inactive. Current status: REJECTED',
      });
      return;
    case 'pk-sys002':
      writeJson(response, 400, {
        success: false,
        errorCode: 'SYS_002',
        message: 'Validation failed',
        data: {
          tenantCode: 'Mã cơ sở không hợp lệ theo quy định máy chủ.',
        },
      });
      return;
    case 'pk-unknown':
    default:
      writeJson(response, 404, {
        success: false,
        errorCode: 'AUTH_003',
        message: 'Tenant not found',
      });
  }
}

function handleTokenExchange(code: string, response: ServerResponse): void {
  switch (code) {
    case 'code-tenant-admin':
      writeJson(response, 200, {
        success: true,
        data: {
          accessToken: 'jwt-ta-access',
          refreshToken: 'jwt-ta-refresh',
          expiresIn: 300,
          refreshExpiresIn: 1800,
          userId: 'user-ta-1',
          email: 'admin@pk-alpha.vn',
          fullName: 'Nguyễn Văn An',
          roles: ['TENANT_ADMIN'],
          primaryRole: 'TENANT_ADMIN',
          tenantCode: 'pk-alpha',
          targetDashboardUrl: '/tenant/dashboard',
        },
      });
      return;
    case 'code-counter-staff':
      writeJson(response, 200, {
        success: true,
        data: {
          accessToken: 'jwt-cs-access',
          refreshToken: 'jwt-cs-refresh',
          expiresIn: 300,
          refreshExpiresIn: 1800,
          userId: 'user-cs-1',
          email: 'counter@pk-alpha.vn',
          fullName: 'Lê Minh',
          roles: ['COUNTER_STAFF'],
          primaryRole: 'COUNTER_STAFF',
          tenantCode: 'pk-alpha',
          targetDashboardUrl: '/staff/counter',
        },
      });
      return;
    case 'code-superadmin':
      writeJson(response, 200, {
        success: true,
        data: {
          accessToken: 'jwt-sa-access',
          refreshToken: 'jwt-sa-refresh',
          expiresIn: 300,
          refreshExpiresIn: 1800,
          userId: 'user-sa-1',
          email: 'super@nextturn.vn',
          fullName: 'Quản trị nền tảng',
          roles: ['SUPERADMIN'],
          primaryRole: 'SUPERADMIN',
          tenantCode: null,
          targetDashboardUrl: '/admin/dashboard',
        },
      });
      return;
    case 'code-end-user':
      writeJson(response, 403, {
        success: false,
        errorCode: 'AUTH_010',
        message: 'END_USER cannot access management portal',
      });
      return;
    default:
      writeJson(response, 401, {
        success: false,
        errorCode: 'AUTH_005',
        message: 'Invalid authorization code',
      });
  }
}

function handleTokenRefresh(refreshToken: string, response: ServerResponse): void {
  if (refreshToken === 'jwt-ta-refresh') {
    writeJson(response, 200, {
      success: true,
      data: {
        accessToken: 'jwt-ta-access-rotated',
        refreshToken: 'jwt-ta-refresh-rotated',
        expiresIn: 300,
        refreshExpiresIn: 1800,
        userId: 'user-ta-1',
        email: 'admin@pk-alpha.vn',
        fullName: 'Nguyễn Văn An',
        roles: ['TENANT_ADMIN'],
        primaryRole: 'TENANT_ADMIN',
        tenantCode: 'pk-alpha',
        targetDashboardUrl: '/tenant/dashboard',
      },
    });
    return;
  }

  writeJson(response, 401, {
    success: false,
    errorCode: 'AUTH_008',
    message: 'Invalid or expired refresh token',
  });
}

async function waitForHealth(
  baseUrl: string,
  getServerLogs: () => string,
  timeoutMs = 20000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Next.js server binds and serves health probe.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Next.js server at ${baseUrl}. Logs:\n${getServerLogs()}`);
}

/**
 * Starts isolated mock backend HTTP server and production Next.js server for a Playwright worker.
 */
export async function startE2eServers(): Promise<E2eServerHandle> {
  const state: MockBackendState = {
    platformAdminOutage: false,
    tokenExchangeCalls: 0,
    refreshCalls: 0,
    logoutCalls: 0,
  };

  let mockUrl = '';
  const mockServer = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const pathName = requestUrl.pathname;

    if (request.method === 'GET' && pathName === '/api/v1/health') {
      writeJson(response, 200, {
        success: true,
        data: {
          status: 'UP',
          system: 'nextturn-mock',
          version: '1.0.0',
        },
      });
      return;
    }

    if (request.method === 'POST' && pathName === '/api/v1/auth/tenant/verify') {
      const body = await readJsonBody(request);
      const tenantCode = typeof body.tenantCode === 'string' ? body.tenantCode : '';
      handleTenantVerify(tenantCode, mockUrl, response);
      return;
    }

    if (request.method === 'GET' && pathName === '/api/v1/auth/superadmin/login-url') {
      if (state.platformAdminOutage) {
        writeJson(response, 503, {
          success: false,
          errorCode: 'AUTH_011',
          message: 'Keycloak down',
        });
        return;
      }

      writeJson(response, 200, {
        success: true,
        data: {
          tenantId: null,
          tenantCode: null,
          tenantName: null,
          status: 'ACTIVE',
          organisationId: null,
          loginUrl: `${mockUrl}/mock-keycloak/superadmin`,
          allowedRoles: ['SUPERADMIN'],
        },
      });
      return;
    }

    if (request.method === 'POST' && pathName === '/api/v1/auth/token') {
      state.tokenExchangeCalls += 1;
      const body = await readJsonBody(request);
      const code = typeof body.code === 'string' ? body.code : '';
      handleTokenExchange(code, response);
      return;
    }

    if (request.method === 'POST' && pathName === '/api/v1/auth/refresh') {
      state.refreshCalls += 1;
      const body = await readJsonBody(request);
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
      handleTokenRefresh(refreshToken, response);
      return;
    }

    if (request.method === 'POST' && pathName === '/api/v1/auth/logout') {
      state.logoutCalls += 1;
      writeJson(response, 200, { success: true, message: 'OK' });
      return;
    }

    if (request.method === 'GET' && pathName.startsWith('/mock-keycloak/')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        `<!doctype html><html lang="vi"><body><main><h1 data-testid="mock-keycloak">${pathName}</h1></main></body></html>`
      );
      return;
    }

    writeJson(response, 404, { success: false, errorCode: 'NOT_FOUND', message: 'Not found' });
  });

  await new Promise<void>((resolve, reject) => {
    mockServer.on('error', reject);
    mockServer.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const mockAddress = mockServer.address();
  if (!mockAddress || typeof mockAddress === 'string') {
    mockServer.close();
    throw new Error('Failed to bind mock backend server port.');
  }
  mockUrl = `http://127.0.0.1:${mockAddress.port}`;

  const nextPort = await allocateFreePort();
  const baseUrl = `http://127.0.0.1:${nextPort}`;
  const nextBinPath = require.resolve('next/dist/bin/next');

  const nextProcess: ChildProcess = spawn(
    process.execPath,
    [nextBinPath, 'start', '-p', String(nextPort), '-H', '127.0.0.1'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXTTURN_BACKEND_URL: mockUrl,
      },
      stdio: 'pipe',
    }
  );

  let serverLogs = '';
  nextProcess.stdout?.on('data', (chunk: Buffer) => {
    serverLogs += chunk.toString('utf8');
  });
  nextProcess.stderr?.on('data', (chunk: Buffer) => {
    serverLogs += chunk.toString('utf8');
  });

  try {
    await waitForHealth(baseUrl, () => serverLogs);
  } catch (error) {
    nextProcess.kill();
    await new Promise<void>((resolve) => {
      mockServer.close(() => resolve());
    });
    throw error;
  }

  return {
    baseUrl,
    mockUrl,
    state,
    resetState: () => {
      state.platformAdminOutage = false;
      state.tokenExchangeCalls = 0;
      state.refreshCalls = 0;
      state.logoutCalls = 0;
    },
    stop: async () => {
      if (!nextProcess.killed) {
        nextProcess.kill();
      }
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    },
  };
}
