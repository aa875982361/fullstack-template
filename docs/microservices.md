# Microservice Extension

`server/deepseek-service` is intentionally simple and can be copied when adding new services.

For a new service:

1. Copy `server/deepseek-service` to `server/your-service`.
2. Update `package.json`, `Dockerfile`, `PORT`, and routes.
3. Add the service to `server/docker-compose.yml`.
4. Add the service name to CI deployment variables if needed.
5. Expose it through `api-service` or a gateway if the frontend should call it.

Each service should provide:

- `GET /health`
- Clear environment variables in `.env.example`
- A Dockerfile
- Basic tests

