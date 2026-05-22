import { validateEnv } from './env.validation';

const baseEnv = {
  FRONTEND_URL: 'http://localhost:3000',
  JWT_SECRET: 'local-dev-secret-change-before-prod',
  JWT_EXPIRES_IN: '1h',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'world_job_search',
  AI_INTERNAL_BASE_URL: 'http://ai:8000',
  AI_INTERNAL_SHARED_SECRET: 'local-internal-secret',
  DB_SYNCHRONIZE: 'false',
};

describe('validateEnv', () => {
  it('allows local development values outside production', () => {
    expect(validateEnv(baseEnv)).toBe(baseEnv);
  });

  it('blocks weak secrets in production', () => {
    // 2026-05-18 신규: 운영에서 기본 secret이 남아 있으면 서버 시작을 막는지 검증
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://example.com',
        AI_INTERNAL_BASE_URL: 'https://ai.example.com',
      }),
    ).toThrow('JWT_SECRET must be a strong production value');
  });

  it('blocks localhost URLs in production', () => {
    // 2026-05-18 신규: 운영에서 localhost URL이 남아 있으면 서버 시작을 막는지 검증
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        AI_INTERNAL_SHARED_SECRET: 'abcdef0123456789abcdef0123456789',
      }),
    ).toThrow('FRONTEND_URL must not use localhost in production');
  });

  it('requires disabled schema synchronization in production', () => {
    // 2026-05-18 신규: 운영 DB 스키마 자동 동기화가 켜진 상태를 차단하는지 검증
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://example.com',
        JWT_SECRET: '0123456789abcdef0123456789abcdef',
        AI_INTERNAL_BASE_URL: 'https://ai.example.com',
        AI_INTERNAL_SHARED_SECRET: 'abcdef0123456789abcdef0123456789',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow('DB_SYNCHRONIZE must be false in production');
  });
});
