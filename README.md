# Salão: internal salon management system

Mobile-first web app for the owner of a hair salon and her professionals: day/week agenda and customer registry,
used from their phones. There is no online booking by customers; the team books on behalf of the customer.

- **Backend:** Spring Boot (Java 21), PostgreSQL, JWT authentication (7-day tokens).
- **Frontend:** Angular, Tailwind, designed for phone screens (375px) and installable on the home screen.
- **Roles:** `ADMIN` (everything, plus services, working hours and professionals) and `STAFF` (agenda, booking, customers).
  Customers are plain records and cannot log in.

## Requirements

- Java 21 and Maven (the project ships the Maven wrapper)
- PostgreSQL
- Node 20+ and the Angular CLI (`npm install -g @angular/cli`, optional: the npm scripts use the local one)

## Run the backend

1. Create an empty database. The `.devcontainer` creates it for you; otherwise:

   ```bash
   psql -U admin -h localhost postgres -c "CREATE DATABASE salon_db"
   ```

2. Start the API (default `http://localhost:8080`):

   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

All settings come from environment variables. The defaults below are for local development only.

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/salon_db` | JDBC URL |
| `DB_USER` | `admin` | Database user |
| `DB_PASSWORD` | dev default in `application.properties` | Database password |
| `JWT_SECRET` | dev default in `application.properties` | Token signing key. In production use a long random value (32+ characters) |
| `ADMIN_EMAIL` | `admin@salon.com` | E-mail of the admin account created on the first start |
| `ADMIN_PASSWORD` | dev default in `application.properties` | Password of the admin account. In production set it only in the host's environment, never in Git |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Frontend origin(s), no trailing slash, comma-separated |
| `APP_TIMEZONE` | `America/Recife` | Salon time zone |
| `SEED_DEMO_DATA` | `true` | Creates demo data on an empty database (`false` for real use) |
| `PORT` | `8080` | HTTP port |

The schema is created and updated by Hibernate (`ddl-auto=update`). The admin account, the working hours
(Mon-Sat 09:00-18:00, Sunday closed) and the demo data are created only when the database is empty. To start over,
drop and recreate the database.

## Run the frontend

```bash
cd frontend
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/
```

The API address is `apiUrl` in `frontend/src/environments/environment.ts`.

## Default accounts (demo seed)

| Role | E-mail | Password |
|---|---|---|
| Admin | `ADMIN_EMAIL` (default `admin@salon.com`) | `ADMIN_PASSWORD` |
| Professional | `maria@salon.com` | `staff123` |
| Professional | `joao@salon.com` | `staff123` |
| Professional | `ana@salon.com` | `staff123` |

The demo also creates a pt-BR service catalog (Corte, Escova, Coloração, Depilação), 8 customers and about 14
appointments around the current week. **All demo customers are fictional** (phones `81999990001` to `81999990008`).
They have no login.

## Test on a real phone

The phone and the computer must be on the same Wi-Fi network. Use the computer's LAN address (for example `192.168.0.10`).

1. Start the frontend listening on the network: `npm start -- --host 0.0.0.0`
2. In `frontend/src/environments/environment.ts` set `apiUrl` to `http://192.168.0.10:8080`
   (`localhost` would point to the phone itself).
3. Start the backend with the phone's origin allowed:
   `CORS_ALLOWED_ORIGINS=http://localhost:4200,http://192.168.0.10:4200 ./mvnw spring-boot:run`
4. Open `http://192.168.0.10:4200` on the phone. Revert `apiUrl` before building for production.

## Deploy

### Backend (Render web service, Dockerfile)

- Root directory `backend`, runtime Docker.
- Environment variables: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (long random), `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` (the real password, set only in Render), `CORS_ALLOWED_ORIGINS` (frontend URL, no trailing slash,
  comma-separated if there are several), `APP_TIMEZONE` (default `America/Recife`) and `SEED_DEMO_DATA`
  (`true` for the report screenshots, `false` for real use).

- See [`backend/README.md`](backend/README.md) for how to turn Render's `postgres://...` connection string into
  `DB_URL`, `DB_USER` and `DB_PASSWORD`.

- **Start from an empty database.** Hibernate cannot relax constraints or rename columns of an old schema.

### Frontend (static host)

1. Put the backend URL in `frontend/src/environments/environment.ts` (`apiUrl`).
2. Run `npm install && npm run build`.
3. Publish the `dist/<project>/browser` folder (check the exact name with `ls dist`).
4. Add the **SPA rewrite** `/*` -> `/index.html` as a *rewrite* (status 200), not a redirect, so refreshing a deep link
   such as `/customers` works:
   - **Render Static Sites:** Redirects/Rewrites -> source `/*`, destination `/index.html`, action *Rewrite*.
   - **Netlify:** file `frontend/public/_redirects` containing `/* /index.html 200`.
   - **Vercel:** `vercel.json` containing `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.

### After the first deploy

1. Copy the frontend URL (no trailing slash) into `CORS_ALLOWED_ORIGINS` and redeploy the backend.
2. Log in with the admin account and create the real professionals and services. Add every professional as
   "qualified professional" in the services they perform (including the owner's own STAFF account).
3. If you started with `SEED_DEMO_DATA=true` and want a clean system, set it to `false`, recreate the database and
   redeploy.

## Install on the phone's home screen

Chrome (Android): menu -> *Add to Home screen*. The app opens in standalone mode, without the browser bar.
On iOS the shortcut uses a generic icon, because the icon is an SVG and iOS ignores SVG icons.

## Notes

- Registration is disabled (`POST /api/auth/register` answers 403). Accounts are created by the admin under
  *Mais -> Profissionais*.
- Tokens last 7 days. Resetting a password does not revoke tokens that were already issued; deactivating a professional
  does block them immediately.