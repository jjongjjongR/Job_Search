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

export function validateEnv(env: EnvRecord) {
  requireValue(env, 'JWT_SECRET');
  requireValue(env, 'JWT_EXPIRES_IN');
  requireValue(env, 'DB_HOST');
  requireNumber(env, 'DB_PORT');
  requireValue(env, 'DB_USERNAME');
  requireValue(env, 'DB_PASSWORD');
  requireValue(env, 'DB_NAME');
  requireValue(env, 'AI_INTERNAL_BASE_URL');
  requireValue(env, 'AI_INTERNAL_SHARED_SECRET');

  return env;
}
