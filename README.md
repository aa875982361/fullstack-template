# Fullstack Template

一个干净的前后端基础框架模板，适合从零开发新的小程序、H5 和微服务项目。

## What Is Included

- `frontend/`: Taro 4 + React + TypeScript，可构建微信小程序和 H5。
- `server/api-service/`: 主 API 服务，提供健康检查和网关示例。
- `server/deepseek-service/`: 示例 AI 微服务，没有配置 API Key 时自动返回 mock 结果。
- `server/volumes/api/kong.yml`: Kong 网关，统一暴露 Supabase 和业务服务。
- Supabase self-hosted services: Kong, Auth, REST, Realtime, Storage, Postgres.
- `server/scripts/run-db-patches.sh`: 自动执行可重复运行的数据库补丁。
- `server/docker-compose.yml`: 本地和服务器通用的服务编排。
- `.github/workflows/`: PR 检查、测试环境部署、生产环境部署骨架。
- `docs/`: 开发、部署、数据库补丁、小程序上传和微服务扩展说明。

## Quick Start

```bash
node scripts/create-local-env.mjs

cd server
docker compose up -d --build
scripts/run-db-patches.sh
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:3021/health

cd ../frontend
npm install --legacy-peer-deps
npm run build:h5
npm run build:weapp
```

## Branch Flow

- Feature branches: develop new work.
- Pull request: run lint, tests, frontend build, Docker build.
- `test`: deploy test backend and frontend, upload WeChat trial build.
- `main`: deploy production backend and frontend, upload production mini program build.

## Initialize A New Project

Update names, domains, image namespace, app IDs, and server secrets in:

- `.env.example`
- `server/.env`
- `.github/workflows/*.yml`
- `frontend/project.config.json`
- `server/docker-compose.yml`

Then push this repository to your own remote.

## Public Repository Safety

`.env.example` intentionally contains placeholders only. Run `node scripts/create-local-env.mjs` to generate a local `server/.env` with development-only Supabase JWTs and passwords. Never commit `server/.env`.
