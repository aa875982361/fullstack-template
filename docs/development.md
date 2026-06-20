# Local Development

## Backend

```bash
node scripts/create-local-env.mjs
cd server
docker compose up -d --build
API_BASE_URL="http://127.0.0.1:$(docker compose port kong 8000 | sed 's/.*://')"
```

Service URLs:

- Kong gateway: `$API_BASE_URL`
- API service: `$API_BASE_URL/api`
- DeepSeek example service: `$API_BASE_URL/deepseek/v1`
- Image generation service: `$API_BASE_URL/images/v1`
- Supabase REST: `$API_BASE_URL/rest/v1`
- Supabase Auth: `$API_BASE_URL/auth/v1`
- Supabase Storage: `$API_BASE_URL/storage/v1`

Useful checks:

```bash
API_BASE_URL="http://127.0.0.1:$(docker compose port kong 8000 | sed 's/.*://')"
curl "$API_BASE_URL/api/health"
curl "$API_BASE_URL/api/ping"
curl -X POST "$API_BASE_URL/deepseek/v1/chat" \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"message":"hello"}'
curl -X POST "$API_BASE_URL/images/v1/generations" \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"prompt":"星际穿越，黑洞，复古列车，电影大片"}'
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
