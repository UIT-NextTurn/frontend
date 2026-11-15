# NextTurn Frontend Module Map

Architecture overview of the Next.js App Router BFF and authentication scaffold landed in track `scaffold_tenant_auth_20261114`. See [ADR-0001](./adr/0001-nextjs-bff-proxy.md) for the BFF security boundary.

## App Router Pages (`src/app/`)

| Route | Module | Role / Responsibility |
| --- | --- | --- |
| `/login` | `src/app/login/page.tsx` | Checks server cookies; redirects active sessions to their portal or renders `TenantSelectionForm` (`TENANT_ADMIN` / `COUNTER_STAFF` Tenant Selection). |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | Wraps `OidcCallbackClient` in `<Suspense>` with a StrictMode single-exchange guard; forwards `?code` to `POST /api/auth/token`, handles `?error` / missing `?code` / `AUTH_010` (`END_USER`) recovery UI, and routes strictly by server-verified `role`. |
| `/[tenantSlug]/tenant` | `src/app/[tenantSlug]/tenant/page.tsx` | Server-guarded Tenant Administrator portal (`TENANT_ADMIN`); verifies session and `tenantSlug` match via `getServerSession`, rendering `PortalAccessDenied` on mismatch or `TenantPortalShell` when authorized. |
| `/[tenantSlug]/counter` | `src/app/[tenantSlug]/counter/page.tsx` | Server-guarded Counter Staff portal (`COUNTER_STAFF`); verifies session and `tenantSlug` match via `getServerSession`, rendering `PortalAccessDenied` or `TenantPortalShell`. |
| `/admin` | `src/app/admin/page.tsx` | `force-dynamic` Platform Administrator entry (`SUPERADMIN`); calls `admin-entry-service.ts` (`GET /api/v1/auth/superadmin/login-url` without `X-Tenant-Code`), renders the dark-mode placeholder (`#0B0F19` / `#111827` / `#6366F1`) with `LogoutButton`, returns `403` access-denied UI for Tenant roles, or renders `AdminRetryButton` (`Thử lại`) on upstream failure. |

## BFF Route Handlers (`src/app/api/`)

All browser-originated backend requests terminate in Next.js Route Handlers so `httpOnly` tokens and upstream headers stay server-side:

- `src/app/api/health/route.ts`: Health probe endpoint (`/api/health`).
- `src/app/api/auth/tenant/verify/route.ts`: Validates `tenantCode` requests and intentionally omits `X-Tenant-Code` when calling `POST /api/v1/auth/tenant/verify`, returning status recovery errors or tenant branding with `loginUrl`.
- `src/app/api/auth/token/route.ts`: Exchanges an OIDC authorization code through `src/lib/bff/auth-token-proxy.ts`, normalizes auth domain errors (`AUTH_003`, `AUTH_004`, `AUTH_005`, `AUTH_007`, `AUTH_008`, `AUTH_010`, `AUTH_011`), writes `httpOnly` (`SameSite=Lax`, `Path=/`, `Secure` in production) auth cookies, and clears stale cookies on terminal auth errors.
- `src/app/api/auth/refresh/route.ts`: Exchanges the refresh cookie through `src/lib/bff/auth-token-proxy.ts` and rotates or clears auth cookies.
- `src/app/api/auth/logout/route.ts`: Forwards server-side `accessToken` and `refreshToken` to backend `POST /api/v1/auth/logout` and always clears `httpOnly` session cookies.

## Feature Modules (`src/features/auth/`)

- `tenant-verify.schema.ts`, `tenant-selection-form.tsx`: Zod schema and interactive form for verifying `Mã cơ sở` (`tenantCode`) and starting OIDC sign-in.
- `auth-session.schema.ts`, `oidc-callback-client.tsx`: Token-exchange schemas and callback client state machine (XSS-safe error rendering, recovery actions, role-based redirect).
- `portal-guard-view.tsx`, `tenant-portal-shell.tsx`, `logout-button.tsx`: Shared `PortalAccessDenied`, Tenant Administrator and Counter Staff portal shell, and `Đăng xuất` button calling `POST /api/auth/logout`.
- `admin-entry-service.ts`, `admin-retry-button.tsx`: Platform Administrator OIDC entry URL lookup helper and client retry button without Tenant switching chrome.

## Shared Infrastructure (`src/lib/` & `src/components/ui/`)

- `src/lib/env.ts`: Validated runtime environment configuration for BFF and public settings.
- `src/lib/auth/session-cookies.ts`: Cookie setters/clearers and server session helpers (`getServerAuthCookies`, `getServerSession`).
- `src/lib/bff/envelope.ts`: Normalized backend `{ success, errorCode, message, data, pagination? }` envelope handling and auth error catalog mapping.
- `src/lib/bff/auth-token-proxy.ts`: Shared upstream token/refresh exchange proxy used by `/api/auth/token` and `/api/auth/refresh`.
- `src/lib/utils.ts`: Tailwind class merge utility (`cn`).
- `src/components/ui/`: Reusable accessible UI primitives (`alert.tsx`, `button.tsx`, `card.tsx`).

## End-to-End Smoke Suite (`e2e/`)

- `e2e/support/e2e-harness.ts`: Test harness utilities and BFF route mocking helpers.
- `e2e/auth-smoke.spec.ts`: Playwright verification covering `desktop-chromium` and `mobile-chromium` (`375x812`) auth entry, callback, portal guards, and `/admin`.
