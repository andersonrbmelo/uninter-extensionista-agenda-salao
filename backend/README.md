# Salon API

REST API for the internal management system of a hair/beauty salon (college project): agenda and customer registry
for the owner and her professionals. There is no online booking by customers.
Stack: Java 21, Spring Boot 4.1.2, Spring Security + JWT, Spring Data JPA, PostgreSQL.

The overview, the frontend and the deploy summary are in the [root README](../README.md).

## Requirements

- Java 21
- Maven (or the included `mvnw` wrapper)
- PostgreSQL

## Run locally

1. Start PostgreSQL with the default settings used by the app (or use the one from the devcontainer):

   ```bash
   docker run --name salon-db -e POSTGRES_DB=salon_db -e POSTGRES_USER=admin \
     -e POSTGRES_PASSWORD=senha_secreta -p 5432:5432 -d postgres:16
   ```

2. From the `backend` folder:

   ```bash
   ./mvnw spring-boot:run
   ```

   The API starts on http://localhost:8080. Tables are created automatically
   (`spring.jpa.hibernate.ddl-auto=update`). On an **empty** database the admin account, the working hours and
   (when `SEED_DEMO_DATA=true`) the demo data are created on the first run. To start over, drop and recreate the database.

3. Try the endpoints with `requests.http` (VS Code/Cursor extension "REST Client").
   Run the login requests first: the tokens are captured automatically.

## Seed data

| Role  | Email                                       | Password                                   |
|-------|---------------------------------------------|--------------------------------------------|
| ADMIN | `ADMIN_EMAIL` (default `admin@salon.com`)   | `ADMIN_PASSWORD` (default `admin123`, dev) |
| STAFF | maria@salon.com                             | staff123                                   |
| STAFF | joao@salon.com                              | staff123                                   |
| STAFF | ana@salon.com                               | staff123                                   |

Always created on an empty database: the admin and the working hours (Mon-Sat 09:00-18:00, Sunday closed).

Created only when `SEED_DEMO_DATA=true` (default): the three professionals above, a catalog in Brazilian Portuguese
(Corte, Escova, Coloração, Depilação, with price options and qualified professionals), 8 fictional customers
(phones `81999990001` to `81999990008`) and about 14 appointments around the current week.
Customers are plain records: they have no password and cannot log in.

## Authentication

`POST /api/auth/login` returns `{ token, user }`. Send the token on every other request:

```
Authorization: Bearer <token>
```

- Only active `ADMIN` and `STAFF` users can log in. Tokens last 7 days.
- `POST /api/auth/register` answers `403 Registration is disabled` while `app.registration-enabled=false` (default).
  The frontend does not use it. Professionals are created by the admin (`POST /api/staff`).
- Resetting a password does not revoke tokens already issued. Deactivating a professional blocks their account immediately.

## Endpoints

| Area      | Endpoints                                                                                   | Access                                 |
|-----------|---------------------------------------------------------------------------------------------|----------------------------------------|
| Auth      | `POST /api/auth/login`, `POST /api/auth/register` (disabled by default)                     | public                                 |
|           | `GET /api/auth/me`                                                                          | authenticated                          |
| Services  | `GET /api/services`, `GET /api/services/{id}`                                               | authenticated                          |
|           | `POST /api/services`, `PUT /api/services/{id}`, `DELETE /api/services/{id}` (soft delete)   | ADMIN                                  |
| Staff     | `GET /api/staff`, `POST /api/staff`                                                         | ADMIN                                  |
|           | `PATCH /api/staff/{id}/password`, `PATCH /api/staff/{id}/deactivate`                        | ADMIN                                  |
| Customers | `GET /api/customers?search=`, `GET /api/customers/{id}`, `POST /api/customers`              | ADMIN, STAFF                           |
| Schedule  | `GET /api/working-hours`, `GET /api/availability`                                           | authenticated                          |
|           | `PUT /api/working-hours`                                                                    | ADMIN                                  |
| Bookings  | `POST /api/bookings` (for a `customerId`)                                                   | ADMIN (any professional), STAFF (self) |
|           | `PATCH /api/bookings/{id}/cancel`, `PATCH /api/bookings/{id}/complete`                      | ADMIN (any), STAFF (own)               |
|           | `GET /api/bookings?from=&to=` (calendar)                                                    | ADMIN (all), STAFF (own)               |

The full contract is in `API.md` and `API-v2.md` (v2 overrides v1).

Errors always use the format `{ "status": 409, "message": "...", "timestamp": "..." }`.

`GET /api/customers` is paginated. Query parameters: `page` (starts at 0, default 0) and `size` (default 20, maximum 100).
The response format is `{ "content": [...], "page": 0, "size": 20, "totalElements": 42, "totalPages": 3 }`.
The customer history inside `GET /api/customers/{id}` is not paginated.

### Phone numbers

Phones are normalised to digits only. A leading `55` is dropped only when 12 or 13 digits remain. A valid number has
a 2-digit area code plus 9 digits (mobile) or 8 digits (landline); anything else is rejected with
`400 phone: Invalid phone number`. `search` on customers accepts any formatting (`(81) 99999`, `+55 81 99999-8888`);
it is case-insensitive but accent-sensitive. The phone is not unique.

## Configuration (environment variables)

All values have local defaults, so the app runs without any setup.

| Variable               | Default                                      |
|------------------------|----------------------------------------------|
| `DB_URL`               | `jdbc:postgresql://localhost:5432/salon_db`  |
| `DB_USER`              | `admin`                                      |
| `DB_PASSWORD`          | `senha_secreta`                              |
| `PORT`                 | `8080`                                       |
| `JWT_SECRET`           | dev-only value (change it in production)     |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` (comma-separated)    |
| `ADMIN_EMAIL`          | `admin@salon.com`                            |
| `ADMIN_PASSWORD`       | `admin123`                                   |
| `APP_TIMEZONE`         | `America/Recife`                             |
| `SEED_DEMO_DATA`       | `true`                                       |

## Docker

```bash
docker build -t salon-api .
docker run --rm -p 8080:8080 \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/salon_db \
  -e DB_USER=admin -e DB_PASSWORD=senha_secreta \
  salon-api
```

On Linux, add `--add-host=host.docker.internal:host-gateway` to the `docker run` command.

## Deploy on Render

1. Create a **PostgreSQL** database on Render. It must be **empty** before the first start.
2. Create a **Web Service** from the repository:
   - Runtime: **Docker**
   - Root Directory: `backend`
   - Dockerfile Path: `./Dockerfile`
   - Leave the Health Check Path empty (every endpoint except login/register requires authentication).
3. Set these environment variables on the Web Service:

| Variable               | Value                                                                                  |
|------------------------|----------------------------------------------------------------------------------------|
| `DB_URL`               | `jdbc:postgresql://<host>:<port>/<database>` (see below)                               |
| `DB_USER`              | database user shown by Render                                                          |
| `DB_PASSWORD`          | database password shown by Render                                                      |
| `JWT_SECRET`           | long random string, at least 32 bytes (e.g. `openssl rand -base64 48`)                 |
| `CORS_ALLOWED_ORIGINS` | frontend URL(s), comma-separated, no trailing slash (e.g. `https://my-app.example.com`) |
| `ADMIN_EMAIL`          | admin login email                                                                      |
| `ADMIN_PASSWORD`       | strong admin password (do not keep `admin123`); set only in Render, never in Git       |
| `APP_TIMEZONE`         | `America/Recife`                                                                       |
| `SEED_DEMO_DATA`       | `true` for demo/report screenshots, `false`