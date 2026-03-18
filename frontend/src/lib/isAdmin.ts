import type { AuthUser } from './auth';

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'MASTER';
}
