# node.js-authentication-API

Authentication API built with Express 5, MongoDB/Mongoose 9 and JWT. It covers registration, login, rotating refresh tokens, password change, password reset by email, and logging out of all devices.

## Quick start

```bash
cp .env.example .env   # then fill in DB_URL, JWT_SECRET_KEY, SMTP settings
npm install
npm run dev            # or: npm start
npm test               # integration tests (in-memory MongoDB replica set)
```

Requires Node 20.19+.

## Endpoints

All routes live under `/api/v1/auth`.

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/register` | – | `first_name, last_name, email, password, confirm_password` |
| POST | `/login` | – | `email, password` |
| POST | `/refresh` | – | `refreshToken` |
| POST | `/logout` | – | `refreshToken` |
| POST | `/forgot-password` | – | `email` |
| POST | `/reset-password` | – | `token, password, confirm_password` |
| GET | `/me` | Bearer | – |
| POST | `/change-password` | Bearer | `old_password, new_password, confirm_password` |
| POST | `/logout-all` | Bearer | – |

Health checks: `GET /healthz` (liveness) and `GET /readyz` (pings the database).

### Responses

```json
{ "success": true, "message": "User logged in successfully",
  "data": { "user": { … }, "accessToken": "…", "refreshToken": "…" } }

{ "success": false, "message": "Invalid input parameters",
  "errors": ["A valid email is required."], "requestId": "…" }
```

Status codes: 401 for missing, invalid or revoked tokens and bad credentials; 409 for a duplicate email; 422 for validation errors; 429 when rate limited; 503 when SMTP isn't configured for password reset.

## Token model

- **Access token:** a JWT (HS256, pinned) that lasts 15 minutes by default. Send it as `Authorization: Bearer <token>`. It includes a `tokenVersion`, and bumping that version revokes every outstanding access token. The version is bumped on a password change, a password reset, `/logout-all`, and when refresh-token reuse is detected.
- **Refresh token:** an opaque 256-bit random value (7 days by default). Only its HMAC is stored. Each token can be used once, and `/refresh` returns a new pair. If a token that was already rotated is presented again, every session for that user is revoked. Clients should share a single in-flight refresh request across tabs and requests.
- **Password reset:** the email links to `PASSWORD_RESET_URL?token=…`, and the frontend posts that token to `/reset-password`. The token is stored as an HMAC, expires after 30 minutes, and can be used once. `/forgot-password` returns the same response whether or not the email exists.

## Production checklist

- `NODE_ENV=production`, `JWT_SECRET_KEY` of at least 32 characters, `CORS_ORIGINS` set (the app refuses to boot otherwise)
- `TRUST_PROXY` matches the number of reverse-proxy hops
- SMTP variables set, and `PASSWORD_RESET_URL` points at the frontend
- Indexes synced (`autoIndex` is off in production): run `Model.syncIndexes()` as a deploy step
- `/readyz` wired to the platform health check
- Running more than one instance: switch rate limiting to a shared store (e.g. `rate-limit-redis`)

Docker: `docker build -t auth-api . && docker run --env-file .env -p 5000:5000 auth-api`

## Migrating from 1.x

| 1.x | 2.x |
|---|---|
| `POST /auth/register` | `POST /api/v1/auth/register` (now returns **201**) |
| `POST /auth/login` | `POST /api/v1/auth/login` |
| `POST /auth/refresh` → `newRefreshToken` | `POST /api/v1/auth/refresh` → `data.refreshToken` (old token becomes invalid) |
| `POST /auth/change_password` | `POST /api/v1/auth/change-password` (returns new tokens) |
| `POST /auth/reset_password` | `POST /api/v1/auth/forgot-password` |
| `POST /auth/reset_password/:id/:token` | `POST /api/v1/auth/reset-password` with `{ token, password, confirm_password }` |

All payloads are now wrapped in `{ success, message, data }`. Tokens issued by 1.x are not accepted.
