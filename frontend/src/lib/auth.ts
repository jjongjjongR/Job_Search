export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  isEmailVerified?: boolean;
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

  try {
    if (rawUser) {
      return JSON.parse(rawUser) as AuthUser;
    }

    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      return null;
    }

    const [, payload] = accessToken.split('.');
    if (!payload) {
      return null;
    }

    // 2026-05-16 신규: JWT base64url payload를 브라우저 atob가 읽을 수 있는 base64 문자열로 변환
    const normalizedPayload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');

    // 2026-05-16 신규: user 캐시가 없을 때 JWT payload에서 보호 페이지 표시용 사용자 정보를 복구
    const decodedPayload = JSON.parse(atob(normalizedPayload)) as {
      sub?: string;
      email?: string;
      username?: string;
      displayName?: string;
      role?: string;
      isEmailVerified?: boolean;
    };

    // 2026-05-16 신규: 토큰에 필수 사용자 정보가 있을 때만 로그인 사용자로 인정
    if (
      !decodedPayload.sub ||
      !decodedPayload.email ||
      !decodedPayload.username ||
      !decodedPayload.displayName ||
      !decodedPayload.role
    ) {
      return null;
    }

    return {
      id: decodedPayload.sub,
      email: decodedPayload.email,
      username: decodedPayload.username,
      displayName: decodedPayload.displayName,
      role: decodedPayload.role,
      isEmailVerified: decodedPayload.isEmailVerified,
    };
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
