export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// 2026-03-18 신규: 같은 탭에서도 로그인 상태 변경을 즉시 알리기 위한 커스텀 이벤트 이름
export const AUTH_STATE_CHANGED_EVENT = 'world-job-search-auth-state-changed';

const ACCESS_TOKEN_KEY = 'world_job_search_access_token';
const USER_KEY = 'world_job_search_user';

export function saveAuth(data: LoginResponse) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  // 2026-03-18 신규: 로그인 직후 헤더가 바로 갱신되도록 현재 탭에 이벤트 전파
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}

export function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // 2026-03-18 신규: 로그아웃 직후 헤더가 바로 갱신되도록 현재 탭에 이벤트 전파
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}
