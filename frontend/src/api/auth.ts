import type { Staff } from '../types/domain';

/**
 * 登录会话：JWT 只存 localStorage，所有物业接口靠它鉴权。
 * 身份由令牌决定，前端任何请求都不再携带 staffId。
 */

const TOKEN_KEY = 'rentfind.accessToken';
const REFRESH_KEY = 'rentfind.refreshToken';
const STAFF_KEY = 'rentfind.staff';

export interface Session {
  access: string;
  refresh: string;
  staff: Staff;
}

export function saveSession(session: Session): void {
  localStorage.setItem(TOKEN_KEY, session.access);
  localStorage.setItem(REFRESH_KEY, session.refresh);
  localStorage.setItem(STAFF_KEY, JSON.stringify(session.staff));
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentStaff(): Staff | null {
  const raw = localStorage.getItem(STAFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Staff;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(STAFF_KEY);
}
