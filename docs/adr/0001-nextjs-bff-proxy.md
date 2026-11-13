---
status: accepted
---

# Use Next.js BFF Proxy for Backend API and Auth

We will route frontend-to-backend HTTP traffic through Next.js Route Handlers acting as a Backend-for-Frontend (BFF) proxy rather than issuing authenticated or tenant-scoped requests directly from browser Client Components.

## Context

The NextTurn Java backend resolves tenant context via the `X-Tenant-Code` request header and validates customer widget requests with `X-Widget-Key` / `widgetSecretKey`, but its default CORS configuration (`cors.allowed-headers`) omits both custom headers on `/**`. In addition, staff authentication relies on Keycloak OIDC authorization-code token exchange and refresh tokens that are safer to keep out of browser storage.

## Considered Options

- **Next.js BFF Proxy (Chosen):** Route handlers under `src/app/api/` store OIDC and customer OTP tokens in `httpOnly` cookies, derive `X-Tenant-Code` from the active `/<tenantSlug>` route or session, attach `X-Widget-Key` server-side, and proxy requests to the backend origin.
- **Direct Browser-to-Backend Calls:** Client Components call Spring Boot directly using browser-stored bearer tokens and query/header parameters, requiring backend CORS header reconfiguration and exposing tokens to client JavaScript.

## Consequences

- Browser requests stay same-origin against Next.js, avoiding CORS header failures on `X-Tenant-Code` and `X-Widget-Key` while keeping TanStack Query intact on the client.
- Next.js server runtime must have network reachability to the Java backend base URL and manage cookie refresh/invalidation cleanly across portals.
