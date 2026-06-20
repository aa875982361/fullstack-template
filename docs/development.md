# Local Development

## Backend

```bash
node scripts/create-local-env.mjs
cd server
docker compose up -d --build
```

Service URLs:

- Kong gateway: `http://127.0.0.1:8000`
- API service direct port: `http://127.0.0.1:3000`
- DeepSeek example service: `http://127.0.0.1:3021`
- Supabase REST: `http://127.0.0.1:8000/rest/v1`
- Supabase Auth: `http://127.0.0.1:8000/auth/v1`
- Supabase Storage: `http://127.0.0.1:8000/storage/v1`

Useful checks:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/ping
curl http://127.0.0.1:3021/health
curl -X POST http://127.0.0.1:8000/deepseek/v1/chat \
  -H 'content-type: application/json' \
  -d '{"message":"hello"}'
```

Run database patches manually:

```bash
cd server
scripts/run-db-patches.sh
```

## Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev:h5
npm run build:h5
npm run build:weapp
```

The frontend reads these build-time variables:

- `TARO_APP_API_BASE_URL`
- `TARO_APP_H5_BASE_URL`

## Supabase Keys

`.env.example` contains placeholders only, so it is safe to commit to a public repository.

For local development, run `node scripts/create-local-env.mjs` to generate `server/.env` with development-only `ANON_KEY`, `SERVICE_ROLE_KEY`, and `JWT_SECRET` values.

For production, generate a new `JWT_SECRET`, then generate matching anon and service role JWTs before deploying.
