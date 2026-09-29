# Shamba OS — web portal

The owner and manager web dashboard for Shamba OS. Requirements: [mvp.md](mvp.md). Design: [build.md](build.md). API: the Django backend in `ShambaOS-m`.

Vite, React 19, TypeScript, React Router, React Query (server state), zustand (session and UI state), Recharts.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With the default `.env.development` (`VITE_MOCK=all`) the portal runs with no backend, on seeded demo data:

| Phone | Signs in as |
| --- | --- |
| 0712 345 678 | John Kamau, owner of Kamau farm, and manager of a second farm account |
| 0722 000 111 | Otieno, field worker (no money anywhere) |
| any other number | a new user: goes through farm setup and "What's on your farm?" |

Any 6 digits work as the code. Demo data lives in the browser's localStorage; clear site data to reset it.

## Against the real backend

The backend today serves identity, tenancy (members, invitations) and payment requests. Everything else in the design (farms, onboarding, stock, sales, finance, weather, alerts, dashboard) is not built yet, so the portal serves those routes from an in-browser mock that follows `docs/backend-architecture.md`.

| `VITE_MOCK` | What happens |
| --- | --- |
| `all` | Every route is mocked. No backend needed. |
| `missing` | Routes Django has go to Django (`/api` is proxied to `localhost:8000`); the rest are mocked. OTP sign-in, members and invitations are real. An M-Pesa sale creates a real SasaPay payment request. |
| `none` | No mock. Use once the backend serves every route. |

Set it in `.env.local`. `VITE_API_TARGET` changes the proxy target.

When the backend ships a route, add it to `IMPLEMENTED` in [src/api/client.ts](src/api/client.ts) and delete its handler from [src/api/mock/server.ts](src/api/mock/server.ts). Nothing else changes: the portal already calls the paths and shapes in the architecture doc. Once the schema covers them, `npm run gen:api` generates types from `/api/v1/schema` to replace the hand-written ones in [src/api/types.ts](src/api/types.ts).

### Endpoints the portal expects that the backend doesn't have yet

`GET /catalogue` · `GET/POST /farms`, `PATCH /farms/{id}`, `POST /farms/{id}/types` · `GET /navigation?farm_id` · `POST /onboarding` · `GET/POST /plots`, `GET /plots/{id}/history` · `GET/POST /structures` · `GET /enterprises`, `GET /enterprises/{id}` (with `kpis`), `/records`, `/health`, `/production`, `/close-summary`, `POST /close` · `GET/POST /animals`, `POST /animals/{id}/exit` · `POST /milk-records`, `/feeding-records`, `/treatments` · `POST /batches`, `/batches/{id}/days` · `POST /seasons`, `GET/POST /seasons/{id}/activities`, `/harvests` · `GET /items`, `PATCH /items/{id}` · `GET /stock/balances`, `/stock/movements`, `POST /stock/movements/{id}/reverse`, `/stock/counts`, `/stock/transfers` · `GET/POST /customers`, `/suppliers` · `GET/POST /sales`, `GET /sales/{id}`, `POST /sales/{id}/payments` · `GET/POST /purchases`, `POST /purchases/{id}/payments` · `GET/POST /finance/entries` · `GET /reports/profit`, `/reports/cost-per-unit` · `POST /exports` · `GET /weather` · `GET /alerts`, `POST /alerts/{id}/seen` · `GET /dashboard`.

Request and response shapes are in [src/api/types.ts](src/api/types.ts). `POST /sales` with `payment.method = "mpesa"` is expected to create the payment request server-side and return it as `payment_request`; the portal then polls the sale.

## Where things are

```
src/
  api/          client (auth refresh, X-Org-Id, error envelope, mock routing), endpoints, hooks, types
  api/mock/     the temporary in-browser backend and its seed data
  stores/       session (tokens, memberships, active organisation), UI (language, farm, period), toasts
  i18n/         en.ts and sw.ts; sw is typed against en, so a missing translation fails the build
  styles/       tokens.css (the palette and scale from build.md), base, components, shell
  components/   ui kit and the app shell
  features/     one folder per screen
```

## Conventions

- Colours come from `tokens.css` only. Fills use the palette colour, text uses the `-ink` variant.
- Money is `<Money>`: revenue amber, cost terracotta, profit and loss with a sign and a word.
- Every cache key starts with the user and organisation (`useKey`). Switching organisation clears the cache.
- Hiding money in the UI (`useCan("money.read")`) is a convenience; the server redacts it.
- Charts carry a text summary, a legend for two or more series, and a "Show the numbers" table.

## Not done yet

- Drawing plot boundaries on a map (FRM-03) and a map pin for the farm location; GPS and county are in.
- Tile pictures are emoji placeholders until images are tested with farmers.
- The Swahili text is a draft for native-speaker review (build.md W6).
- The main bundle is about 940 kB before gzip; route-level code splitting would cut the first load.
- No automated tests yet.
