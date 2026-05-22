export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'world_job_search',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
  ai: {
    internalBaseUrl:
      process.env.AI_INTERNAL_BASE_URL ?? 'http://localhost:8000',
    internalSharedSecret:
      process.env.AI_INTERNAL_SHARED_SECRET ?? 'replace-with-internal-secret',
  },
  // 2026-05-18 신규: AWS 이전 시 storage provider 값을 설정에서 추적할 수 있게 명시
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    root: process.env.BACKEND_STORAGE_ROOT ?? 'storage',
  },
});
