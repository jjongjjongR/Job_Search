type EnvRecord = Record<string, string | undefined>;

function requireValue(env: EnvRecord, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required.`);
  }

  return value;
}

function requireNumber(env: EnvRecord, key: string): number {
  const rawValue = requireValue(env, key);
  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${key} must be a number.`);
  }

  return parsedValue;
}

// 2026-05-18 신규: 운영 배포에서 로컬/기본 비밀값이 그대로 올라가는 것을 시작 단계에서 차단
function requireProductionSafeValue(env: EnvRecord, key: string) {
  const value = requireValue(env, key);
  const unsafeValues = new Set([
    'change-me',
    'please-change-this-secret',
    'replace-with-internal-secret',
    'local-internal-secret',
    'local-dev-secret-change-before-prod',
  ]);

  if (value.length < 32 || unsafeValues.has(value)) {
    throw new Error(
      `Environment variable ${key} must be a strong production value.`,
    );
  }
}

// 2026-05-18 신규: 운영 배포에서 localhost 기반 URL이 남아 있으면 컨테이너 간/브라우저 통신이 깨지므로 차단
function forbidLocalhostInProduction(env: EnvRecord, key: string) {
  const value = requireValue(env, key);
  if (/localhost|127\.0\.0\.1/.test(value)) {
    throw new Error(
      `Environment variable ${key} must not use localhost in production.`,
    );
  }
}

export function validateEnv(env: EnvRecord) {
  requireValue(env, 'FRONTEND_URL');
  requireValue(env, 'JWT_SECRET');
  requireValue(env, 'JWT_EXPIRES_IN');
  requireValue(env, 'DB_HOST');
  requireNumber(env, 'DB_PORT');
  requireValue(env, 'DB_USERNAME');
  requireValue(env, 'DB_PASSWORD');
  requireValue(env, 'DB_NAME');
  requireValue(env, 'AI_INTERNAL_BASE_URL');
  requireValue(env, 'AI_INTERNAL_SHARED_SECRET');

  // 2026-05-18 신규: AWS/운영 배포 직전 필수 안전장치를 production 모드에서 강제
  if (env.NODE_ENV === 'production') {
    requireProductionSafeValue(env, 'JWT_SECRET');
    requireProductionSafeValue(env, 'AI_INTERNAL_SHARED_SECRET');
    forbidLocalhostInProduction(env, 'FRONTEND_URL');
    forbidLocalhostInProduction(env, 'AI_INTERNAL_BASE_URL');

    if (env.DB_SYNCHRONIZE !== 'false') {
      throw new Error('Environment variable DB_SYNCHRONIZE must be false in production.');
    }
  }

  return env;
}
