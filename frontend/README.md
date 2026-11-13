# Salão: frontend

Mobile-first Angular app (standalone components, signals, Tailwind) for the owner and the professionals of the salon.
It is designed for 375px phone screens and can be installed on the home screen. All visible text is in Brazilian
Portuguese. The overview and the deploy summary are in the [root README](../README.md); the API is described in
[`../backend/README.md`](../backend/README.md).

## Requirements

- Node 20+ and npm
- The backend running (default `http://localhost:8080`)

## Run

```bash
npm install
npm start          # http://localhost:4200
```

To open the app from a phone on the same network: `npm start -- --host 0.0.0.0`, set `apiUrl` to the computer's
LAN address, and allow the phone's origin in the backend's `CORS_ALLOWED_ORIGINS` (see the root README).

## Environment

The API address is `apiUrl` in `src/environments/environment.ts` (no trailing slash), for example
`http://localhost:8080` locally or the Render URL in production.

## Build

```bash
npm run build
```

The production build is written to `dist/<project>/browser` (check the exact name with `ls dist`).
Publish that folder on any static host and add a **rewrite** (status 200, not a redirect) from `/*` to `/index.html`,
so refreshing a deep link such as `/customers` works:

- **Render Static Sites:** Redirects/Rewrites -> source `/*`, destination `/index.html`, action *Rewrite*.
- **Netlify:** `public/_redirects` containing `/* /index.html 200`.
- **Vercel:** `vercel.json` containing `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.

Remember to add the published URL (no trailing slash) to `CORS_ALLOWED_ORIGINS` on the backend and redeploy it.

## Screens and routes

| Path | Screen | Who |
|---|---|---|
| `/login` | Login (team only, no sign-up) | logged out |
| `/calendar` | Agenda (Dia / Semana) | STAFF, ADMIN |
| `/book` | Book an appointment for a customer | STAFF, ADMIN |
| `/customers`, `/customers/:id` | Customer list, quick-create, detail with history | STAFF, ADMIN |
| `/admin/services`, `/admin/services/new`, `/admin/services/:id` | Services | ADMIN |
| `/admin/working-hours` | Working hours | ADMIN |
| `/admin/staff` | Professionals (create, reset password, deactivate) | ADMIN |

Navigation is a bottom bar: Agenda, Agendar, Clientes, plus "Mais" (Serviços, Horários, Profissionais) for the admin.

## Project structure

```
src/app/
  core/       services (API), auth, guards, models, date and phone helpers, pt-BR error dictionary
  layout/     shell with the top bar and the bottom navigation
  shared/     small reusable components (alert, confirm dialog, pagination, status badge, ...)
  features/   one folder per area: auth, calendar, customer (booking), admin
```

## Conventions

- Standalone components, `inject()`, signals, `OnPush`, `@if` / `@for`, reactive typed forms, no `any`.
- Dates are salon-local strings. Never use `toISOString()`; use `core/date-utils.ts`.
- API errors are shown with `apiErrorMessage(err)`, which translates the backend messages to Portuguese.
- Mobile only: no `sm:` / `md:` variants; the shell centers every page with a maximum width.

## Web app manifest

`public/manifest.webmanifest` and `public/icon.svg` make the app installable (standalone display, rose theme color).
`index.html` sets `viewport-fit=cover` so the bottom navigation respects the phone's safe area.