# Deployment

The template ships with GitHub Actions workflows for CI, test deploys, and production deploys.

## Required Secrets

Common:

- `IMAGE_REGISTRY`
- `IMAGE_NAMESPACE`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `POSTGRES_PASSWORD`
- `KONG_HTTP_PORT`
- `API_EXTERNAL_URL`
- `SITE_URL`

Test:

- `TEST_SERVER_HOST`
- `TEST_SERVER_USER`
- `TEST_SERVER_PATH`
- `TEST_SSH_PRIVATE_KEY`
- `TEST_H5_HTTP_PORT`

Production:

- `PROD_SERVER_HOST`
- `PROD_SERVER_USER`
- `PROD_SERVER_PATH`
- `PROD_SSH_PRIVATE_KEY`

Mini program:

- `WX_APPID`
- `WX_PRIVATE_KEY`
- `WX_ROBOT`

## Server Requirements

- Docker
- Docker Compose v2
- SSH access for the GitHub Actions deploy key

The remote deploy script uploads compose files and pulls backend and H5 images from the configured registry.
It also uploads `server/volumes`, including Kong and database initialization files required by Supabase.
After containers are started, it automatically runs `server/scripts/run-db-patches.sh`.

For test deploys, the H5 frontend is served by the `h5` container at `http://<TEST_SERVER_HOST>:<TEST_H5_HTTP_PORT>`.

Production checklist:

- Replace all development Supabase secrets from `.env.example`.
- Keep the remote `server/.env` out of Git.
- Point frontend builds at the Kong gateway URL, not a direct service port.
- Keep every SQL patch idempotent. See `docs/db-patches.md`.
