# NextTurn Frontend

Web frontend and BFF layer for the multi-tenant NextTurn queue-management and appointment-booking SaaS. See [docs/module-map.md](./docs/module-map.md) for the App Router and BFF layout, and [ADR-0001](./docs/adr/0001-nextjs-bff-proxy.md) for the proxy boundary.

## Stack

- **Language & Runtime:** TypeScript (`strict`), Node.js
- **Framework:** Next.js App Router (`src/` layout, `--webpack` dev/build on Windows) & React
- **Styling & UI:** Tailwind CSS, `shadcn/ui`, `@fontsource/be-vietnam-pro`, `@fontsource/jetbrains-mono`
- **Forms, Data & URL State:** React Hook Form + Zod, TanStack Query, `nuqs`
- **Testing & Quality:** Jest + React Testing Library, Playwright (`desktop-chromium` + `mobile-chromium`), ESLint + Prettier
- **Package Manager:** `pnpm`

## Commands (PowerShell 7)

```powershell
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
$env:CI = 'true'; pnpm test --coverage
pnpm build
$env:CI = 'true'; pnpm test:e2e
```

Notes for Windows / `pnpm` v12+:

- Use `pnpm test --coverage` rather than `pnpm test -- --coverage` so `pnpm` does not pass `--` as a Jest test-path filter.
- `pnpm build` and `pnpm test:e2e` run `next build --webpack` / `next dev --webpack` (`package.json`) for Windows stability.

