# Salon API Contract

Reference for the Angular frontend of the internal salon app. It describes every endpoint of the backend (`/backend`):
request bodies, responses, validation rules, error messages, permissions and gotchas.
When this document and the backend code disagree, the backend code wins. Example calls live in `backend/requests.http`.

The system is **internal**: only the owner (`ADMIN`) and her professionals (`STAFF`) have accounts. Customers are plain
records created by the team; they have no password and cannot log in.

## 1. Conventions

### Base URL and CORS

- Local: `http://localhost:8080`. Production: the Render URL (configure it in the Angular environment files).
- The backend allows the origins listed in `CORS_ALLOWED_ORIGINS` (default `http://localhost:4200`), all methods (including `PATCH`) and all headers.

### Authentication

- Log in with `POST /api/auth/login` and send the token on every other request:
  `Authorization: Bearer <token>`.
- The token expires after **7 days**. There is no refresh token and no logout endpoint (logout = discard the token on the client).
- Only `POST /api/auth/register` and `POST /api/auth/login` are public. Every other endpoint needs a valid token.
  Registration is disabled by default (see section 4).
- Request bodies are JSON (`Content-Type: application/json`). `PATCH` cancel/complete/deactivate have no body.
- The user's role and status are read from the database on every request. A deactivated professional gets `401` on their
  next request, even with a valid token. The `user.role` stored by the frontend can become stale: call `GET /api/auth/me`
  when the app starts to refresh it.

### Roles

`ADMIN` and `STAFF` log in. `CUSTOMER` is the role of customer records (no login). Professionals are created by the admin
(`POST /api/staff`); there is no promote/demote.

### Data formats

| Type | Format | Example |
|---|---|---|
| Date (`LocalDate`) | `YYYY-MM-DD` | `2026-11-16` |
| Date and time (`LocalDateTime`) | `YYYY-MM-DDTHH:mm:ss`, **no timezone** | `2026-11-16T09:00:00` |
| Time (`LocalTime`) | requests accept `HH:mm` or `HH:mm:ss`; responses use `HH:mm:ss` | `09:00:00` |
| Error `timestamp` | ISO instant (UTC, ends with `Z`) | `2026-11-10T18:30:12.123Z` |
| Money (`price`) | JSON number, 2 decimals, no currency in the API | `120.00` |
| Phone | digits only, no formatting (see section 3) | `81999998888` |
| Enums | uppercase strings | `BOOKED`, `MONDAY`, `STAFF` |

Time zone rules (important):

- All date-times are in the **salon's local time** (`America/Recife`) and carry no offset.
  Treat them as plain strings. Do not convert them with `toISOString()` or `new Date(...)` timezone math.
- To book a slot, send back **exactly the string** returned by `/api/availability`.
- `createdAt` fields can include fractional seconds (e.g. `2026-11-10T15:30:12.123456`).
- `null` fields are present in the JSON as `null` (they are not omitted).

### Error format

Every error uses the same body:

```json
{ "status": 409, "message": "Selected time slot is not available", "timestamp": "2026-11-10T18:30:12.123Z" }
```

| Status | Meaning |
|---|---|
| 400 | Validation error, malformed body, missing or invalid parameter, or an invalid combination of ids |
| 401 | Missing/invalid/expired token, inactive user, or wrong login |
| 403 | Authenticated, but the role or ownership does not allow the action |
| 404 | Resource not found |
| 405 | HTTP method not allowed on that URL |
| 409 | Business conflict (slot taken, booking already completed/cancelled, duplicate email, ...) |
| 415 | Unsupported content type |
| 500 | Unexpected server error (`"Unexpected error"`) |

Validation errors (400) join all field problems in one string: `field: message; otherField: message`.
Nested fields use bracket paths, for example `priceOptions[0].label: Price option label is required`.
The frontend translates `message` to Portuguese in `core/api-error.ts` instead of hard-coding the rules.

### Pagination

Only `GET /api/customers` is paginated.

- Query params: `page` (starts at 0, default 0), `size` (default 20, maximum 100; values outside 1..100 are clamped, negative `page` becomes 0).
- Response:

```json
{ "content": [ ], "page": 0, "size": 20, "totalElements": 42, "totalPages": 3 }
```

- A page beyond the last one returns an empty `content` (not an error).
- All other list endpoints return a plain JSON array, including the booking history inside `GET /api/customers/{id}`.

## 2. Permissions at a glance

| Endpoint | STAFF | ADMIN |
|---|:-:|:-:|
| `POST /api/auth/register` | public (disabled by default) | public (disabled by default) |
| `POST /api/auth/login` | public | public |
| `GET /api/auth/me` | yes | yes |
| `GET /api/services`, `GET /api/services/{id}` | yes | yes |
| `POST/PUT/DELETE /api/services` | no | yes |
| `/api/staff/**` | no | yes |
| `GET /api/customers`, `GET /api/customers/{id}`, `POST /api/customers` | yes | yes |
| `GET /api/working-hours` | yes | yes |
| `PUT /api/working-hours` | no | yes |
| `GET /api/availability` | yes | yes |
| `POST /api/bookings` | yes, only with their own `staffId` | yes, any qualified professional |
| `PATCH /api/bookings/{id}/cancel` | only bookings where they are the professional | any |
| `PATCH /api/bookings/{id}/complete` | only bookings where they are the professional | any |
| `GET /api/bookings?from=&to=` (calendar) | own bookings only | all bookings |

A wrong role returns `403` with `"Access is denied"`. STAFF can read any customer, including the history with other professionals.

## 3. Phone rules

Apply to every endpoint that receives a phone (customers, staff) and to the customer search term.

- Normalisation: keep digits only; drop a leading `55` **only if** 12 or 13 digits remain (so an area code 55 is not damaged).
- Valid: `^[1-9][0-9](9[0-9]{8}|[0-9]{8})$` (10 or 11 digits: area code + 9-digit mobile or 8-digit landline).
  Otherwise `400` `phone: Invalid phone number`.
- Stored and returned as digits only (for example `81999998888`). The client formats it for display.

| Typed | Stored |
|---|---|
| `(81) 99999-8888` | `81999998888` |
| `+55 81 99999-8888` / `5581999998888` | `81999998888` |
| `55 99999-8888` (area code 55) | `55999998888` (not stripped) |
| `3333-4444` or `123` | rejected: `Invalid phone number` |

## 4. TypeScript models

```ts
export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type BookingStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED';
export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface ErrorResponse { status: number; message: string; timestamp: string; }

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Auth
export interface UserSummary { id: number; name: string; email: string; role: Role; }
export interface AuthResponse { token: string; user: UserSummary; }
export interface LoginRequest { email: string; password: string; }

// Services
export interface PriceOption { id: number; label: string; price: number; durationMinutes: number; }
export interface StaffSummary { id: number; name: string; }
export interface SalonService {
  id: number; name: string; description: string | null; active: boolean;
  priceOptions: PriceOption[]; qualifiedStaff: StaffSummary[];
}
export interface PriceOptionRequest {
  id?: number | null; // omit/null = new option, filled = update that existing option
  label: string; price: number; durationMinutes: number;
}
export interface ServiceRequest {
  name: string; description?: string | null; active: boolean;
  priceOptions: PriceOptionRequest[]; staffIds: number[];
}

// Staff
export interface StaffResponse { id: number; name: string; email: string; phone: string | null; }
export interface CreateStaffRequest { name: string; email: string; password: string; phone: string; }
export interface ResetPasswordRequest { password: string; }

// Customers (in the frontend these live in core/customers.service.ts)
export interface CustomerSummary {
  id: number; name: string; email: string | null; phone: string | null; createdAt: string;
}
export interface CustomerDetail extends CustomerSummary {
  allergies: string | null; notes: string | null;
  bookings: Booking[]; // newest first, all statuses, NOT paginated
}
export interface CustomerRequest {
  name: string; phone: string; email?: string; allergies?: string; notes?: string;
}

// Schedule
export interface WorkingHours {
  dayOfWeek: DayOfWeek; open: boolean;
  openTime: string | null; closeTime: string | null; // "HH:mm:ss", null on closed days
}

// Bookings
export interface BookingRequest {
  customerId: number; serviceId: number; priceOptionId: number; staffId: number;
  startTime: string; // "2026-11-16T09:00:00"
}
export interface Booking {
  id: number;
  customerId: number; customerName: string; customerPhone: string | null;
  staffId: number; staffName: string;
  serviceName: string; optionLabel: string; price: number; // snapshots taken at booking time
  startTime: string; endTime: string;
  status: BookingStatus;
  createdAt: string;
}
```

## 5. Auth

### POST /api/auth/login (public)

Request: `{ "email": "admin@salon.com", "password": "admin123" }`

`200`:

```json
{
  "token": "eyJhbGciOiJIUzM4NCJ9...",
  "user": { "id": 1, "name": "Admin", "email": "admin@salon.com", "role": "ADMIN" }
}
```

Only active users with role `ADMIN` or `STAFF` and a password can log in. Errors: `400` validation,
`401` `"Invalid email or password"` for wrong credentials, an unknown e-mail, a customer record or an inactive user
(always the same message). The token lasts 7 days.

### POST /api/auth/register (public, disabled)

- While `app.registration-enabled=false` (default): `403` `"Registration is disabled"`.
- When enabled: body `{ "name", "email", "password" }`, creates a `CUSTOMER` account and returns `201` with `AuthResponse`
  (a customer cannot log in afterwards). The frontend does not use it.
- Validation messages: `Name is required`, `Email is required`, `Invalid email`, `Password is required`,
  `Password must have between 6 and 72 characters`. `409` `"Email is already registered"`.

### GET /api/auth/me

Returns `UserSummary` of the logged user. `401` when the token is missing, invalid, expired, or the user is inactive.
Use it on app start to refresh the stored role.

### Configuration that affects the API

| Property | Env var | Default | Notes |
|---|---|---|---|
| `jwt.expiration-ms` | | `604800000` (7 days) | |
| `app.registration-enabled` | | `false` | |
| `app.admin.email` | `ADMIN_EMAIL` | `admin@salon.com` | |
| `app.admin.password` | `ADMIN_PASSWORD` | `admin123` | dev default only; the real value is set in the host's environment, never committed |
| `app.seed.demo-data` | `SEED_DEMO_DATA` | `true` | demo data only on an empty database |

## 6. Customers (ADMIN and STAFF)

Customers are records: role `CUSTOMER`, no password, no login. There is no endpoint to edit or delete them.

### GET /api/customers?search=&page=&size=

Paginated list sorted by name. `search` (optional) matches, case-insensitively, a part of the name or e-mail, **or** the
phone digits. The term is normalised, so `(81) 99999`, `+55 81 99999-8888` and `99999` all work. The search is
accent-sensitive (`joao` does not find `João`).

```json
{
  "content": [
    { "id": 5, "name": "Cliente Exemplo", "email": null, "phone": "81999990001", "createdAt": "2026-11-09T10:15:00.123456" }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

### GET /api/customers/{id}

```json
{
  "id": 5,
  "name": "Cliente Exemplo",
  "email": null,
  "phone": "81999990001",
  "createdAt": "2026-11-09T10:15:00.123456",
  "allergies": "Látex",
  "notes": "Prefere horários pela manhã",
  "bookings": [ ]
}
```

- `bookings`: the full history, **newest first**, all statuses, same shape as `Booking`, not paginated.
- `404` `"Customer not found"` (also for ids of staff or admin users).

### POST /api/customers

```json
{
  "name": "Cliente Teste",
  "phone": "(81) 99999-8888",
  "email": "teste@example.com",
  "allergies": "Látex",
  "notes": "Prefere horários pela manhã"
}
```

| Field | Rules and messages |
|---|---|
| `name` | required, max 100 (`Name is required`, `Name must have at most 100 characters`); trimmed |
| `phone` | required (`Phone is required`), see section 3 (`Invalid phone number`); **not unique** |
| `email` | optional, valid (`Invalid email`), unique; trimmed and lower-cased, blank becomes `null` |
| `allergies` | optional, max 2000 (`Allergies must have at most 2000 characters`); trimmed, blank becomes `null` |
| `notes` | optional, max 2000 (`Notes must have at most 2000 characters`); trimmed, blank becomes `null` |

`201` with `CustomerSummary`. Errors: `400` field messages, `409` `"Email is already registered"`.
To warn about a duplicate phone, call `GET /api/customers?search=<digits>` before saving: the API itself accepts duplicates.

## 7. Services (catalog)

`SalonService` response:

```json
{
  "id": 1,
  "name": "Coloração",
  "description": "Coloração completa",
  "active": true,
  "priceOptions": [
    { "id": 4, "label": "Curto", "price": 120.00, "durationMinutes": 90 },
    { "id": 5, "label": "Médio", "price": 160.00, "durationMinutes": 120 },
    { "id": 6, "label": "Longo", "price": 200.00, "durationMinutes": 150 }
  ],
  "qualifiedStaff": [ { "id": 2, "name": "Maria" } ]
}
```

- A service always has at least one price option (for example `"Padrão"`).
- The order of `priceOptions` is not guaranteed: sort in the UI (by `price` or `durationMinutes`).
- `qualifiedStaff` is sorted by name and lists **active** professionals only. It is the list to use for the professional
  choice when booking. A deactivated professional is removed from every service.

### GET /api/services (any authenticated user)

Array of **active** services sorted by name. Not paginated. Inactive services never appear here.

### GET /api/services/{id} (any authenticated user)

One service. It also returns inactive services (it does not check `active`). `404` `"Service not found"`.

### POST /api/services (ADMIN)

Creates the whole service in one request.

```json
{
  "name": "Manicure",
  "description": "Cuidado das unhas",
  "active": true,
  "priceOptions": [ { "label": "Padrão", "price": 35.00, "durationMinutes": 45 } ],
  "staffIds": [2, 3]
}
```

| Field | Rules and messages |
|---|---|
| `name` | required, max 100 (`Name is required`) |
| `description` | optional, max 1000 |
| `active` | required boolean (`Active flag is required`) |
| `priceOptions` | at least one (`At least one price option is required`) |
| `priceOptions[].label` | required, max 100 (`Price option label is required`) |
| `priceOptions[].price` | required, >= 0 (`Price is required`, `Price cannot be negative`) |
| `priceOptions[].durationMinutes` | required, >= 1 (`Duration is required`, `Duration must be at least 1 minute`) |
| `staffIds` | required list, may be empty (`staffIds is required (use an empty list for none)`) |

- `201` with the `SalonService`.
- `400` `"One or more staffIds do not exist"`, `400` `"User {id} is not a staff member"` (only users with role `STAFF` are accepted).
- A service with no `staffIds` can exist but nobody can be booked for it.

### PUT /api/services/{id} (ADMIN)

Same body as `POST`. It replaces name, description, active, the staff list and the price options.

Price options are merged by `id`:

- an item **with** `id` updates that existing option;
- an item **without** `id` creates a new option;
- existing options **missing** from the list are deleted.

To edit a service, load it first and send back the existing option ids; otherwise the options are recreated and the old ones deleted.

Errors: `404` `"Service not found"`, `400` (same as `POST`), `400` `"Price option {id} does not belong to this service"`,
`409` `"Price option 'Curto' has bookings and cannot be removed"` (an option with bookings cannot be deleted; edit it instead).

### DELETE /api/services/{id} (ADMIN)

Soft delete: sets `active=false`. `204` with no body. Existing bookings are kept and not cancelled. `404` if the id does not exist.

## 8. Staff management (ADMIN only)

`StaffResponse`: `{ "id": 2, "name": "Maria", "email": "maria@salon.com", "phone": "81999990100" }`

### GET /api/staff

Array of **active** users with role `STAFF`, sorted by name (admins, customers and deactivated users excluded). Not paginated.

### POST /api/staff

Creates an active professional.

```json
{ "name": "Carla", "email": "carla@salon.com", "password": "carla123", "phone": "(81) 98888-7777" }
```

| Field | Rules and messages |
|---|---|
| `name` | required, max 100 (`Name is required`) |
| `email` | required, valid, unique; normalised to lower case (`Email is required`, `Invalid email`) |
| `password` | required, 6-72 characters (`Password is required`, `Password must have between 6 and 72 characters`) |
| `phone` | required (`Phone is required`), see section 3 (`Invalid phone number`) |

`201` with `StaffResponse`. Errors: `400` validation, `409` `"Email is already registered"`.

### PATCH /api/staff/{id}/password

Request: `{ "password": "novaSenha123" }` (6-72 characters). `204` with no body.
`404` `"Staff member not found"` (unknown id, not a professional, or inactive).
Tokens already issued stay valid until they expire (up to 7 days).

### PATCH /api/staff/{id}/deactivate

`204` with no body. Sets the user inactive and removes them from every service's `qualifiedStaff`.
Their account stops working immediately (login and existing tokens return `401`). There is no reactivation.

Errors: `404` `"Staff member not found"`, `409` `"Staff member has future bookings"` (any `BOOKED` booking that has not ended yet).

## 9. Working hours and availability

### GET /api/working-hours (any authenticated user)

Always 7 items, from `MONDAY` to `SUNDAY`:

```json
[
  { "dayOfWeek": "MONDAY", "open": true, "openTime": "09:00:00", "closeTime": "18:00:00" },
  { "dayOfWeek": "SUNDAY", "open": false, "openTime": null, "closeTime": null }
]
```

Default seed: Monday to Saturday 09:00-18:00, Sunday closed. These hours are salon-wide (not per professional).

### PUT /api/working-hours (ADMIN)

The body is a **plain JSON array** (not wrapped in an object) with exactly 7 items, one per day:

```json
[
  { "dayOfWeek": "MONDAY", "open": true, "openTime": "09:00", "closeTime": "18:00" },
  { "dayOfWeek": "SUNDAY", "open": false }
]
```

- Open days need `openTime` before `closeTime`. Closed days: send `open: false` and omit the times (or send `null`).
- `200` with the updated list (same shape as `GET`).
- `400` messages:
  `"Exactly 7 items are required, one for each day of the week"`,
  `"Each item needs dayOfWeek and open"`,
  `"Duplicate day: MONDAY"`,
  `"Open days need openTime before closeTime (MONDAY)"`.
  An unknown `dayOfWeek` value or bad time format returns `400` `"Malformed or invalid request body"`.
- Changing the hours does not touch existing bookings.

### GET /api/availability (any authenticated user)

Query params (all required): `serviceId`, `priceOptionId`, `staffId`, `date` (`YYYY-MM-DD`).

`200`: a **plain array** of selectable start times, ascending:

```json
["2026-11-16T09:00:00", "2026-11-16T09:30:00", "2026-11-16T10:00:00"]
```

A start time is listed only if **all** of these hold:

- the day is open in the working hours;
- the slot starts on the 30-minute grid counted from the opening time (09:00, 09:30, 10:00, ...);
- the slot ends (start + duration of the chosen price option) no later than the closing time;
- the start is in the future (salon time);
- the chosen professional has no `BOOKED` booking overlapping it (`CANCELLED` and `COMPLETED` do not block).

The array is empty (`[]`, not an error) when the day is closed, in the past, or fully booked.

Errors:

- `400` `"Missing required parameter: date"`, `400` `"Invalid value for parameter 'date'"`;
- `404` `"Service not found"`, `404` `"Staff member not found"`;
- `400` `"Service is not active"`, `400` `"Price option does not belong to this service"`,
  `400` `"User is not a staff member"`, `400` `"Staff member is not qualified for this service"`.

Availability is a snapshot. Someone else can take the slot before you book it, so always handle `409` on booking.

## 10. Bookings

`Booking` response:

```json
{
  "id": 7,
  "customerId": 5,
  "customerName": "Cliente Exemplo",
  "customerPhone": "81999990001",
  "staffId": 2,
  "staffName": "Maria",
  "serviceName": "Corte",
  "optionLabel": "Padrão",
  "price": 50.00,
  "startTime": "2026-11-16T09:00:00",
  "endTime": "2026-11-16T09:30:00",
  "status": "BOOKED",
  "createdAt": "2026-11-10T15:30:12.123456"
}
```

- `serviceName`, `optionLabel` and `price` are **snapshots** copied at booking time. They do not change if the admin edits the catalog later.
- `endTime` = `startTime` + duration of the price option.
- `status`: `BOOKED` → `COMPLETED` or `CANCELLED`. A `COMPLETED` or `CANCELLED` booking never changes again.

### POST /api/bookings (ADMIN and STAFF)

Books **for** a customer. Request (all fields required):

```json
{ "customerId": 5, "serviceId": 1, "priceOptionId": 1, "staffId": 2, "startTime": "2026-11-16T09:00:00" }
```

- `201` with the `Booking`.
- `400` validation (`customerId is required`, `serviceId is required`, `priceOptionId is required`, `staffId is required`,
  `startTime is required`), `400` `"Malformed or invalid request body"` for a bad `startTime`.
- `404` `"Customer not found"` (unknown id, or the id is not a customer), `404` `"Service not found"`, `404` `"Staff member not found"`.
- `400` for an invalid combination (same messages as availability: inactive service, option from another service, user not staff, professional not qualified).
- `403` `"You can only create bookings for yourself"`: a STAFF user must send their own id as `staffId`. ADMIN may use any qualified professional.
- `409` `"Selected time slot is not available"` when the slot is taken, off the 30-minute grid, outside working hours, or in the past.

### PATCH /api/bookings/{id}/cancel (ADMIN or the assigned STAFF)

No body. `200` with the booking (`status: "CANCELLED"`). The slot becomes available again.

Errors: `404` `"Booking not found"`, `403` `"You cannot cancel this booking"` (a STAFF user who is not the assigned professional),
`409` `"Booking is already COMPLETED"` or `"Booking is already CANCELLED"`.
There is no time limit: a booking that is still `BOOKED` can be cancelled even if its start time has passed.

### PATCH /api/bookings/{id}/complete (ADMIN or the assigned STAFF)

No body. `200` with the booking (`status: "COMPLETED"`).

Errors: `404` `"Booking not found"`, `403` `"You cannot complete this booking"` (a STAFF user who is not the assigned professional),
`409` `"Booking is already COMPLETED"` or `"... CANCELLED"`.
There is no rule tying completion to the booking time.

### GET /api/bookings?from=&to= (ADMIN and STAFF)

Calendar feed.

- `from` and `to` are required dates (`YYYY-MM-DD`), **both inclusive**.
- `ADMIN` receives every booking in the range. `STAFF` receives **only their own** (decided by the token, not by a parameter).
- A **plain array** sorted by `startTime` ascending, with **all statuses** including `CANCELLED` (filter in the UI if needed). Not paginated.
- There is no server-side filter by professional or status: filter on the client.
- Errors: `400` `"'to' must not be before 'from'"`, `400` `"Missing required parameter: from"`, `400` `"Invalid value for parameter 'from'"`.
- The server has no limit on the range: ask for one week at a time (Monday to Sunday).

## 11. Suggested flows

Booking flow (STAFF or ADMIN):

1. Find or create the customer: `GET /api/customers?search=` or `POST /api/customers`.
2. `GET /api/services` → choose a service, then a `priceOption` (shows price and duration).
3. Choose the professional from `service.qualifiedStaff` (STAFF is fixed to themselves; if they are not in the list, they cannot book that service).
4. Choose a date, then `GET /api/availability?...` → show the returned times as buttons.
5. `POST /api/bookings` with the exact time string. On `409`, show the message and reload the availability.
6. Show the result in the calendar; complete or cancel with `PATCH`.

Login and routing:

1. `POST /api/auth/login`, store `token` and `user`.
2. Home for both roles is the calendar. `ADMIN` also manages services, working hours and professionals.
3. On `401`: clear the session and go to the login page. On `403`: show "no permission".

## 12. What the API does not offer

Do not plan screens that depend on these (they do not exist):

- change own password, change e-mail, reactivate a professional, edit or deactivate a customer;
- self-service registration (disabled), customers with a login, a customer profile endpoint;
- refresh token, logout endpoint, e-mail notifications;
- reschedule or edit a booking (cancel and book again instead), notes on a booking;
- listing inactive services (`GET /api/services` returns active ones only), deleting a service permanently;
- per-professional working hours or days off (the hours are salon-wide);
- server-side filtering of the calendar by professional or status;
- paginated booking history, vCard import/export, international phone numbers.

## 13. Seed data (development database)

On an **empty** database the application always creates the admin account (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`) and the
working hours. With `SEED_DEMO_DATA=true` (default) it also creates the demo data below.

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@salon.com` (or `ADMIN_EMAIL`) | `admin123` (or `ADMIN_PASSWORD`) |
| STAFF | `maria@salon.com` | `staff123` |
| STAFF | `joao@salon.com` | `staff123` |
| STAFF | `ana@salon.com` | `staff123` |

| Service | Price options (label, price / minutes) | Qualified professionals |
|---|---|---|
| Corte | Padrão 50.00 / 30 | Maria, João, Ana |
| Escova | Curto 40.00 / 30, Longo 70.00 / 60 | Ana, Maria |
| Coloração | Curto 120.00 / 90, Médio 160.00 / 120, Longo 200.00 / 150 | Maria, Ana |
| Depilação | Padrão 40.00 / 30 | João |

Also seeded: 8 fictional customers (phones `81999990001` to `81999990008`, 3 with allergies/notes, 2 with an e-mail; none can log in)
and about 14 appointments in the previous and the current week.

Ids are assigned by the database and can differ. Never hard-code ids in the frontend.